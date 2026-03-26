# Skill: Prospeo API

Used by: List Builder agent, lead enrichment scripts

This skill defines how to authenticate with, query, and paginate the Prospeo API for prospect list building and contact enrichment.

---

## Authentication

All requests use an API key in the `X-KEY` header:

```
X-KEY: {PROSPEO_API_KEY}
Content-Type: application/json
```

Never hardcode the key. If `PROSPEO_API_KEY` is not set, halt and report to the Orchestrator.

---

## Endpoints

### Active (as of March 2026)

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `https://api.prospeo.io/search-person` | POST | People search with 30+ filters. Primary endpoint. |
| `https://api.prospeo.io/search-company` | POST | Company search. |
| `https://api.prospeo.io/enrich-person` | POST | Enrich individual lead. |
| `https://api.prospeo.io/bulk-enrich-person` | POST | Bulk enrich up to 50 leads. |
| `https://api.prospeo.io/enrich-company` | POST | Company data enrichment. |

### Deprecated (removed March 2026)

These no longer work and return `DEPRECATED` errors:
- `domain-search`
- `email-finder`
- `social-url-search`

Note: `mobile-finder` is NOT deprecated. Mobile numbers are returned via `enrich-person` and filterable in `search-person` under Contact Details filters.

---

## Search Person API

**POST** `https://api.prospeo.io/search-person`

### Request Structure

```json
{
  "page": 1,
  "filters": {
    "company": {
      "websites": { "include": ["sky.com", "trainline.com"] },
      "names": { "include": ["Harrods", "TUI UK"] }
    },
    "person_job_title": { "include": ["Head of Email", "CRM Manager"] },
    "person_seniority": { "include": ["Director", "Head", "Manager"] },
    "company_industry": { "include": ["Retail"] },
    "company_headcount_range": ["51-200", "201-500"],
    "person_location_search": { "include": ["United Kingdom #GB"] }
  }
}
```

### Filter Format Rules

| Filter | Format | Notes |
|--------|--------|-------|
| `company.websites` | `{"include": [...]}` nested inside `company` object | Root domains only (e.g. `sky.com` not `www.sky.com`). Max 500 items. |
| `company.names` | `{"include": [...]}` nested inside `company` object | Max 500 items combined with websites. |
| `person_job_title` | `{"include": [...]}` | Matches exact titles. |
| `person_seniority` | `{"include": [...]}` | Valid values: `Founder/Owner`, `C-Suite`, `Partner`, `Vice President`, `Head`, `Director`, `Manager`, `Senior`, `Entry`, `Intern`. NOT "VP", "C-Level", or other abbreviations. |
| `company_industry` | `{"include": [...]}` | Must match Prospeo's industry taxonomy. |
| `company_headcount_range` | Plain array `[...]` | NOT `{include: [...]}`. Values like `"1-10"`, `"11-50"`, `"51-200"`, `"201-500"`, etc. |
| `person_location_search` | `{"include": [...]}` | Format: `"Country #CC"`, `"Region, Country #CC"`, or `"City, Country #CC"`. Three-part `"City, Region, Country #CC"` is INVALID. |

### Response Structure

```json
{
  "error": false,
  "results": [
    {
      "person": {
        "person_id": "...",
        "first_name": "...",
        "last_name": "...",
        "full_name": "...",
        "linkedin_url": "...",
        "current_job_title": "...",
        "location": "...",
        "job_history": [
          {
            "title": "...",
            "company_name": "...",
            "seniority": "Manager",
            "current": true,
            "start_year": 2024,
            "departments": ["Digital Marketing"]
          }
        ]
      },
      "company": {
        "name": "...",
        "domain": "...",
        "industry": "...",
        "headcount_range": "...",
        "location": "..."
      }
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 25,
    "total_page": 6,
    "total_count": 133
  }
}
```

---

## Pagination

- Default: 25 results per page (not configurable via request)
- Check `pagination.total_page` after first request
- Loop through all pages, collecting results
- Space requests by at least 500ms between pages

---

## Multi-Pass Enrichment Strategy

When enriching a known company list with contacts, use a 3-pass approach:

### Pass 1: Domain search with primary titles
Search by `company.websites` with the most specific ICP titles (e.g. "Head of Email", "CRM Manager", "Email Marketing Manager"). Include seniority filter.

### Pass 2: Domain search with broader titles
For companies that returned no results in Pass 1, search again by `company.websites` with broader titles (e.g. "Head of Marketing", "Marketing Manager", "CMO", "Lifecycle Marketing Manager"). Drop the seniority filter (some profiles are miscategorised).

### Pass 3: Company name search
For companies still missing, search by `company.names` instead of domains. Prospeo may index the company under a different domain (e.g. `sky.uk` instead of `sky.com`, `nbcuni.com` instead of `nbcuniversal.com`, `zillowgroup.com` instead of `zillow.com`).

### Domain Mismatch Handling
Prospeo often returns a different domain than the one you searched. Common examples:
- `sky.com` -> `sky.uk`
- `nbcuniversal.com` -> `nbcuni.com`
- `reuters.com` -> `thomsonreuters.com`
- `zillow.com` -> `zillowgroup.com`
- `atg.co.uk` -> `theambassadors.com`
- `manairport.co.uk` -> `magairports.com`
- `bristolairport.co.uk` -> `bristolairport.com`

Build a manual domain mapping when merging results back to a master list.

---

## Rate Limits

- 429 responses require waiting ~60 seconds before retrying
- Space requests by at least 500ms between pages
- If rate limit persists after retry, stop and report

---

## Response Fields

Key fields to extract from each result:

| Response Path | Use |
|--------------|-----|
| `person.person_id` | Dedup key |
| `person.first_name` | Contact name |
| `person.last_name` | Contact name |
| `person.full_name` | Display name |
| `person.current_job_title` | Title |
| `person.linkedin_url` | LinkedIn profile |
| `person.location` | Location |
| `person.job_history[0].seniority` | Seniority level |
| `person.mobile.mobile` | Mobile number (null if unavailable) |
| `person.mobile.status` | `"AVAILABLE"` or `"UNAVAILABLE"` |
| `person.email.email` | Work email (when `status == "VERIFIED"`) |
| `company.name` | Company name |
| `company.domain` | Company domain (may differ from searched domain) |
| `company.industry` | Industry |
| `company.headcount_range` | Company size |
| `company.phone_hq.phone_hq` | Company HQ phone number |

---

## Error Handling

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| 200 | Success | Continue |
| 400 | Bad request / INVALID_FILTERS | Check filter format. Common causes: wrong seniority values, invalid location format, `company.websites` as flat key instead of nested object. |
| 401 | INVALID_API_KEY | API key missing or invalid. Check `X-KEY` header. |
| 429 | Rate limit exceeded | Wait 60s, retry once. |
| 500 | Server error | Wait 30s, retry once. |
