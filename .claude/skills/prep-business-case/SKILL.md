# Skill: Prep Business Case Deck

Create a tailored Business Case deck for a specific EmailShepherd prospect, pre-filled with their pain points, numbers, and the right case study. Uses the qualification call transcript to extract real context.

---

## When to Use

Trigger phrases:
- "Prep the business case deck for [company]"
- "Business case for [company]"
- "Tailor the deck for [company]"
- "Prep [company] for the business case call"

---

## Inputs Required

1. **Company name** (required)
2. **Qualification call transcript or notes** (required). Accept any of:
   - Full transcript (paste, file path, or YouTube link to a recorded call)
   - Bullet-point notes from the call
   - A summary the user provides verbally
3. **Currency** (optional, default GBP). Ask if the prospect is outside the UK.

If the user hasn't provided a transcript, ask:
> "Do you have the qualification call transcript or notes? Paste it, drop a file path, or share the recording link and I'll extract what I need."

---

## Process

### Step 1: Extract from the transcript

Read the transcript and pull out:

**Pain points** (map to the 3 cards on slide 2):
- **Time**: What did they say about how long emails take, bottlenecks, handoffs, waiting on each other?
- **Cost**: What did they mention about agency spend, team overhead, rework, wasted effort?
- **Quality / Risk**: What came up about errors, brand inconsistency, compliance gaps, platform concerns?

**Their numbers** (use to pre-set calculator defaults on slide 3):
- How many emails per month?
- How many people involved?
- How long does an email take?
- Do they use an agency? Rough spend?
- How many revision rounds?
- Any mention of error frequency?

For any numbers not mentioned, keep the standard defaults.

**Industry and best case study match**:
- Media / publishing / multi-brand: **BBC**
- Retail / eCommerce / time-sensitive: **Major Online Retailer**
- Financial services / regulated / compliance-heavy / large multi-team: **Global Financial Institution**

**Stakeholder intel** (for slide 6):
- Did they mention who else is involved in decisions?
- Did they name specific people, titles, or teams?
- Any mention of budget process or approval chain?

**Specific language**: Capture 2-3 direct quotes or phrases the prospect used. These can be woven into the "What We Heard" cards to show you were listening.

### Step 2: Build the tailored deck

1. Copy the template deck: `clients/emailshepherd/sales/decks/business-case-deck.html`
2. Make these modifications:
   - **Slide 1**: Pre-fill company name, set currency
   - **Slide 2**: Fill in the 3 editable cards with extracted pain points, using their actual language where possible
   - **Slide 3**: Update the JavaScript `state` defaults to match any numbers from the transcript
   - **Slide 5**: Swap to the best-matching case study (see case study HTML in the template and the qualification deck for all 3 versions)
   - **Slide 6**: If stakeholder intel was gathered, add notes to the relevant cards
3. Save as: `clients/emailshepherd/sales/decks/business-case-deck-[company-slug].html`

### Step 3: Upload to Drive

1. Upload the tailored deck to the Business Case folder on Drive
   - Folder ID: check `drive_file_ids.json` for `business-case-folder`
   - File name: "Business Case Deck - [Company Name]"
2. Update `drive_file_ids.json` cache with the new file ID
3. Return the Drive link to the user

### Step 4: Prep summary

Present a brief summary to the user:

```
Business Case Deck prepped for [Company Name]

Key pain points extracted:
- Time: [summary]
- Cost: [summary]
- Quality/Risk: [summary]

Calculator defaults adjusted:
- [any numbers changed from defaults]

Case study: [which one and why]

Stakeholder notes: [any names/titles mentioned]

Local file: clients/emailshepherd/sales/decks/business-case-deck-[slug].html
Drive link: [link]
```

---

## Case Study Reference

All 3 case studies exist in the qualification deck and the business case deck template. The HTML for each follows the same split-layout pattern (dark left panel with metrics, light right panel with before/after).

| Case Study | Best For | Key Metrics |
|------------|----------|-------------|
| BBC | Media, publishing, editorial, multi-brand | 6 brands in 1 month, 17 users, zero broken code |
| Major Online Retailer | Retail, eCommerce, time-sensitive, agency dependency | 2 weeks to 1 day, live data feeds, agency eliminated |
| Global Financial Institution | Finance, insurance, legal, regulated, large teams | 250 users, zero rogue emails, full compliance, 60 segments |

---

## File Locations

- Template deck: `clients/emailshepherd/sales/decks/business-case-deck.html`
- Qualification deck (case study HTML source): `clients/emailshepherd/sales/decks/qualification-call-deck.html`
- Case study markdown: `clients/emailshepherd/sales/case-studies/`
- Drive upload script: `.claude/skills/google-slides/upload_docs.py`
- Drive file ID cache: `.claude/skills/google-slides/drive_file_ids.json`
- Drive Business Case folder ID: stored in cache under `emailshepherd.business-case-folder`

---

## Notes

- Use the prospect's own words wherever possible. If they said "it takes us forever to get an email out the door", use that, not a polished rewrite.
- No em dashes in any copy.
- If the transcript reveals something that changes the sales approach (e.g. they're already in a contract, or they have no budget authority), flag it to the user before building the deck.
- The calculator numbers on slide 3 are still interactive. Pre-setting defaults just means the call starts with realistic numbers rather than generic ones. The salesperson can still adjust live.
