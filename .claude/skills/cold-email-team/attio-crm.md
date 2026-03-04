# Skill: Attio CRM Integration

**Status: Placeholder — not yet implemented**

Used by: (future) List Builder, Reply Handler, Reporting agents

This skill is a placeholder for the Attio CRM integration. Build it when you're ready to connect outreach activity directly to your CRM.

---

## What This Will Enable

- Sync verified prospect lists from List Builder into Attio as new contacts
- Update contact records when replies are received (status, reply category, date)
- Track campaign touchpoints on the Attio contact timeline
- Move contacts through pipeline stages based on reply category (Interested → Opportunity, Not Now → Nurture, etc.)
- Pull Attio data into Researcher briefs (existing relationship context)

---

## Planned Inputs

| Source | Data |
|--------|------|
| List Builder output CSV | New contacts to create in Attio |
| Reply Handler categorisation | Reply events to log on contact records |
| Sending Scheduler | Campaign assignment to track on contact records |

---

## Environment Variable

When ready to build, add to `.env`:

```
ATTIO_API_KEY=your_attio_api_key_here
```

Get your key at: Attio → Settings → API Keys

---

## Attio API Reference

Base URL: `https://api.attio.com/v2/`

Authentication: `Authorization: Bearer {ATTIO_API_KEY}`

Key objects to work with:
- `People` — individual contacts
- `Companies` — company records
- `Notes` — timeline entries for touchpoints
- `Lists` — for pipeline management

---

## Build This Skill When

- You have at least one client campaign running and want to track leads in Attio
- You want to avoid re-contacting existing Attio contacts in future campaigns
- You're ready to use Attio as the source of truth for pipeline stage

Until then, all contact data lives in the `/clients/` folder structure.
