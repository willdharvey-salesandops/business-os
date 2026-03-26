# Skill: Attio CRM Integration

**Status: Active**

Used by: List Builder, Reply Handler, Reporting agents, Orchestrator

---

## Authentication

- **API Key:** `ATTIO_API_KEY` in `.env`
- **Base URL:** `https://api.attio.com/v2/`
- **Auth header:** `Authorization: Bearer {ATTIO_API_KEY}`

---

## Workspace: EmailShepherd

**Workspace ID:** `073ccc26-ae9f-4b33-8d95-491c8da40e00`

### Objects

| Object | API Slug | Purpose |
|--------|----------|---------|
| Companies | `companies` | Prospect organisations |
| People | `people` | Contacts at prospects |
| Deals | `deals` | Active sales opportunities |

### Company Pipeline Stages (select: `pipeline_stage`)

Full journey from cold list to close:

| Stage | Option ID | When |
|-------|-----------|------|
| Prospecting | `3a42d1ab-d8c8-40f7-81ae-266456806347` | On list, not yet contacted |
| Contacted | `ee5bd1c5-f774-4df2-97b3-64853cfbe779` | Cold email sent, no reply |
| Engaged | `de1fb73e-9a57-4b1c-99d0-b002d3b67a3d` | Replied positively, meeting being booked |
| New Lead | `0874d25b-1bc2-420c-91c7-96376784e3c2` | Inbound lead (website/referral) |
| Qualification Scheduled | `d0b75009-cc6f-4e1f-9b41-86e7bc2dc91f` | Call booked |
| Qualification Complete | `7147e1bd-b55f-42da-94b8-0be0acdfb452` | Qualified, moving to business case |
| Business Case | `57065d3d-48d2-46df-9007-527965d2693d` | Building internal case |
| Technical Demo | `95d2ac70-7649-40db-bcc4-3c82661ac80b` | Demo scheduled or complete |
| POC Planning | `4d0c0638-8551-43d7-8cae-8359f8465f2e` | Scoping the proof of concept |
| POC Active | `81c4f0ce-d808-4993-ace8-db51986907df` | POC running |
| POC Check-in | `6bb8d73c-9866-4e27-ba78-302fc3c99040` | Mid-POC review |
| Proposal Submitted | `8ebbb933-61b0-49ef-b2e4-f3f0f712854a` | Commercial offer sent |
| Close Won | `af5ce040-2525-420a-a7cb-f7c2f375180a` | Deal signed |
| Closed Lost | `f787d867-c802-4cca-aa6a-a987a6608ba9` | Deal lost |

### Deal Pipeline Stages (status: `stage`)

Used when a Deal record is created (after a prospect enters the sales cycle):

| Stage | Status ID |
|-------|-----------|
| Qualification | `00f5637d-db34-4d2b-8e4b-4586de221c45` |
| Business Case | `9de79e47-3491-473e-94c3-8ba16b4e32b2` |
| Technical Demo | `40b88d06-1535-44a3-8920-951e9312c273` |
| POC Planning | `c11e1d9f-3343-4fb9-b485-f6513681d1ea` |
| Commercial Offer | `ee841f57-5671-46a1-a296-f89489d11739` |
| Legal | `7b13df4b-2bc9-4c87-8547-00ea374d8cb3` |
| POC Active | `3ce0fb54-97d1-4d8e-8711-d212fe80156b` |
| POC Check-in | `dec5898e-7a53-43b3-9fda-6b093ce47a93` |
| Won | `92facfa5-a70a-44df-9195-82f3f936317f` |
| Lost | `42ba23fc-c606-4b4f-b48c-a820a706a117` |

### Lists

| List | API Slug | Purpose |
|------|----------|---------|
| Assessment Sign Up Leads | `assessment_sign_up_leads` | LGC website audit form submissions |
| Qualified Leads | `qualified_leads_assessment_completed` | LGC qualified leads with scores |

---

## Common API Operations

### Create or update a Company (upsert by domain)

```bash
curl -X PUT "https://api.attio.com/v2/objects/companies/records?matching_attribute=domains" \
  -H "Authorization: Bearer $ATTIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "values": {
        "name": [{"value": "Company Name"}],
        "domains": [{"domain": "example.com"}],
        "pipeline_stage": [{"option": "OPTION_ID_HERE"}]
      }
    }
  }'
```

### Create a Person (linked to company)

```bash
curl -X POST "https://api.attio.com/v2/objects/people/records" \
  -H "Authorization: Bearer $ATTIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "values": {
        "name": [{"first_name": "Jane", "last_name": "Smith"}],
        "email_addresses": [{"email_address": "jane@example.com"}],
        "job_title": [{"value": "Head of Email"}],
        "linkedin": [{"value": "https://linkedin.com/in/janesmith"}],
        "company": [{"target_object": "companies", "target_record_id": "COMPANY_RECORD_ID"}]
      }
    }
  }'
```

### Create a Deal (linked to company + person)

```bash
curl -X POST "https://api.attio.com/v2/objects/deals/records" \
  -H "Authorization: Bearer $ATTIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "values": {
        "name": [{"value": "CompanyName - EmailShepherd POC"}],
        "stage": [{"status": "STATUS_ID_HERE"}],
        "associated_company": [{"target_object": "companies", "target_record_id": "COMPANY_ID"}],
        "associated_people": [{"target_object": "people", "target_record_id": "PERSON_ID"}]
      }
    }
  }'
```

### Update Company pipeline stage

```bash
curl -X PATCH "https://api.attio.com/v2/objects/companies/records/RECORD_ID" \
  -H "Authorization: Bearer $ATTIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "values": {
        "pipeline_stage": [{"option": "OPTION_ID_HERE"}]
      }
    }
  }'
```

### Query companies by pipeline stage

```bash
curl -X POST "https://api.attio.com/v2/objects/companies/records/query" \
  -H "Authorization: Bearer $ATTIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "pipeline_stage": {"option": "OPTION_ID_HERE"}
    },
    "limit": 50
  }'
```

### Add a Note to a record

```bash
curl -X POST "https://api.attio.com/v2/notes" \
  -H "Authorization: Bearer $ATTIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "parent_object": "companies",
      "parent_record_id": "RECORD_ID",
      "title": "Call Notes - Qualification",
      "content_plaintext": "Notes from the call..."
    }
  }'
```

---

## Integration Points

### From Cold Email Pipeline
- **List Builder** -> Creates Companies + People in Attio at "Prospecting" stage
- **Sending Scheduler** -> Updates company to "Contacted" after first email sent
- **Reply Handler** -> Updates to "Engaged" on positive reply, logs note with reply content

### From Sales Process
- **Qualification booked** -> Update to "Qualification Scheduled", create Deal at "Qualification" stage
- **After each call** -> Add Note with call summary, move Deal to next stage
- **POC start** -> Update both Company ("POC Active") and Deal ("POC Active")
- **Close** -> Update to "Close Won"/"Closed Lost" and Deal to "Won"/"Lost"

---

## Current Data (as of 8 Mar 2026)

- **57 companies** imported from master list (all at "Prospecting" stage)
- **103 people** linked to companies (from Prospeo enrichment)
- **0 deals** (none created yet, will be created when prospects enter sales cycle)
