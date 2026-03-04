# Skill: Instantly API Integration

Used by: Sending Scheduler agent, Reply Handler agent, Reporting agent

This skill defines how to authenticate with and use the Instantly API for campaign management, prospect upload, reply monitoring, and stats retrieval.

---

## Authentication

All requests use an API key as a query parameter or header. Read from environment:

```
X-API-Key: {INSTANTLY_API_KEY}
```

Or as query parameter: `?api_key={INSTANTLY_API_KEY}`

Check Instantly's current API documentation for the preferred method — it may vary by endpoint.

Base URL: `https://api.instantly.ai/api/v1/`

> **Note to agent**: Verify current endpoint structure against Instantly's live API docs before first run. The patterns in this skill are the framework — confirm exact paths at runtime.

---

## Key Endpoints

### Campaign Management

| Action | Method | Endpoint |
|--------|--------|---------|
| List campaigns | GET | `/campaign/list` |
| Create campaign | POST | `/campaign/create` |
| Get campaign | GET | `/campaign/{campaign_id}` |
| Update campaign | PATCH | `/campaign/{campaign_id}` |
| Set campaign status | POST | `/campaign/{campaign_id}/status` |

### Prospect Management

| Action | Method | Endpoint |
|--------|--------|---------|
| Add prospects | POST | `/prospect/add` |
| Upload CSV | POST | `/prospect/upload` |
| Get prospect | GET | `/prospect/{email}` |
| Delete prospect | DELETE | `/prospect/{email}` |

### Analytics

| Action | Method | Endpoint |
|--------|--------|---------|
| Campaign analytics | GET | `/analytics/campaign` |
| Account analytics | GET | `/analytics/account` |

### Replies

| Action | Method | Endpoint |
|--------|--------|---------|
| List replies | GET | `/reply/list` |
| Get reply | GET | `/reply/{reply_id}` |
| Update reply status | PATCH | `/reply/{reply_id}` |

---

## Creating a Campaign

Minimum required fields:

```json
{
  "name": "CLIENT - campaign-slug - YYYY-MM-DD",
  "from_accounts": ["sender@domain.com"],
  "status": "paused",
  "sequences": [...]
}
```

**Important**: Always set `"status": "paused"` on creation. The user activates manually.

---

## Sequence Step Format

```json
{
  "sequences": [
    {
      "steps": [
        {
          "type": "email",
          "day": 1,
          "subject": "{{subject_1}}",
          "body": "{{body_1}}"
        },
        {
          "type": "email",
          "day": 5,
          "subject": "{{subject_2}}",
          "body": "{{body_2}}"
        }
      ]
    }
  ]
}
```

---

## Uploading Prospects

Upload prospects with custom fields. Map the personalised CSV columns to Instantly's format:

```json
{
  "campaign_id": "...",
  "prospects": [
    {
      "email": "prospect@company.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "company_name": "Acme Corp",
      "custom_variables": {
        "hook": "Personalised opening line here",
        "subject_1": "Email 1 subject",
        "body_1": "Full email 1 body",
        "subject_2": "Email 2 subject",
        "body_2": "Full email 2 body",
        "subject_3": "...",
        "body_3": "...",
        "subject_4": "...",
        "body_4": "..."
      }
    }
  ]
}
```

Upload in batches of 100 prospects maximum to avoid timeouts.

After each batch, verify the count returned matches the batch size. If there's a mismatch, flag it.

---

## Inbox Rotation

Assign multiple sending accounts to a campaign for inbox rotation:

```json
{
  "from_accounts": [
    "sender1@domain.com",
    "sender2@domain.com"
  ]
}
```

Instantly distributes sends across accounts automatically when multiple are provided.

Read accounts from `SENDING_ACCOUNTS` environment variable (comma-separated).

---

## Daily Limits and Send Window

```json
{
  "sending_limit": 30,
  "send_start": "08:00",
  "send_end": "17:00",
  "timezone": "Europe/London"
}
```

Read `sending_limit` from `DAILY_SEND_LIMIT_PER_INBOX` environment variable (default: 30).

---

## Fetching Replies

```
GET /reply/list?campaign_id={id}&since={timestamp}&status=pending
```

Filter by `status: pending` to get only unhandled replies. After processing a reply, update its status to prevent re-processing.

Pagination: use `page` and `limit` parameters. Loop until all replies are collected.

---

## Fetching Analytics

```
GET /analytics/campaign?campaign_id={id}&start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}
```

Key fields to extract from the response:
- `emails_sent`
- `open_rate`
- `reply_rate`
- `bounce_rate`
- `unsubscribe_rate`

---

## Rate Limits

- Respect Instantly's rate limits per their current documentation
- If you receive a 429: wait 30 seconds and retry once
- Do not hammer the API — space requests by 500ms minimum

---

## Error Handling

| Code | Meaning | Action |
|------|---------|--------|
| 200/201 | Success | Continue |
| 400 | Bad request | Log error body, report to Orchestrator |
| 401 | Unauthorised | Key missing/invalid — halt and report |
| 404 | Not found | Campaign/prospect doesn't exist — report |
| 429 | Rate limited | Wait 30s, retry once |
| 500 | Server error | Wait 60s, retry once — if persists, report |
