---
name: scan-content-ideas
description: Scan YouTube for trending topics in the small business founder niche and return a list of video ideas worth making. Use when asked to "find content ideas", "scan for video ideas", "what should I make a video about", "give me YouTube ideas", or "what's trending in my niche".
disable-model-invocation: true
argument-hint: [optional focus area — e.g. sales, AI, delegation, or leave blank for broad scan]
---

# Scan Content Ideas

Searches YouTube for what's getting traction with small business founders, then filters it through Will's niche, voice, and offer to produce a shortlist of video ideas worth making.

No brain dump needed. Run this when you want inspiration, not when you already have a story.

---

## Inputs

- **Focus area (optional):** `$ARGUMENTS` — a specific topic to narrow the scan (e.g. "sales", "AI tools", "team management"). If blank, run a broad scan across the full niche.
- **Business context:** Read `context/business/clients.md` and `context/business/company.md` before starting — these define the audience and the themes that matter.

---

## Process

**Step 1: Load business context**
Read `context/business/clients.md` and `context/business/company.md`. Hold in mind:
- Who the audience is (founders, 3–20 employees, profitable but stretched)
- The core problems they face (sales still running through them, delegation failing, operational bottleneck, no systems)
- Will's offer areas (sales systems, AI implementation, delegation, leadership, freedom from the business)

**Step 2: Run the searches**
Run 4 searches targeting YouTube content in the founder and small business niche. Vary the angle across searches:

- Search 1: Recent videos on founder pain points — e.g. `"small business owner" sales systems delegation YouTube 2025 2026`
- Search 2: AI tools for business owners — e.g. `"business owner" AI automation tools YouTube trending 2025 2026`
- Search 3: Niche creator content — search for channels close to Will's positioning, e.g. `Dan Martell "buy back your time" youtube video topics 2025` or `founder operations systems youtube titles getting views`
- Search 4: If `$ARGUMENTS` was provided, run a focused search on that topic — e.g. `"small business" [topic] youtube video titles 2025 2026`

**Step 3: Identify patterns**
From the search results, extract:
- Titles and topic angles that are getting traction
- Pain points that keep appearing across multiple searches
- Framing patterns working right now (question format, "the real reason", "how I", case studies, numbered lists)
- Gaps — problems Will's audience has that aren't being well covered yet

**Step 4: Filter through Will's lens**
For each pattern or topic found, ask:
- Does this problem match what Will's clients actually face?
- Could Will speak to this from real experience — a client story, a coaching conversation, something he's worked through?
- Does it fit his offer areas (sales, AI, delegation, leadership)?
- Can it be framed in his voice — calm, grounded, guide not guru?

Drop anything that doesn't pass this filter.

**Step 5: Build the idea list**
Produce 5–8 video ideas. For each one:
- **Title:** A draft title in Will's voice using a trending format
- **Trend signal:** What the search showed — why this topic is getting traction right now
- **Will's angle:** One line on what Will's specific take would be — where his experience and his clients' experiences make this uniquely his
- **Audience pain:** Which specific problem from `clients.md` this addresses
- **Difficulty:** `Low` (Will almost certainly has a client story for this) / `Medium` (needs some thought) / `High` (would need research or a specific case)

**Step 6: Save and present**
Present the ideas in chat.
Save to: `workspace/content/video-ideas/scan-[YYYY-MM-DD].md`
Confirm: "Found [N] ideas — saved to workspace/content/video-ideas/. Want to turn any of these into a script?"

---

## Output Template

```markdown
# Content Ideas Scan — [YYYY-MM-DD]

**Focus:** [Broad / specific topic if provided]
**Ideas found:** [N]

---

## Video Ideas

### 1. [Draft Title]

- **Trend signal:** [What the search showed — why this is getting traction]
- **Will's angle:** [His specific take — what he'd say that others wouldn't]
- **Audience pain:** [Which client problem this maps to]
- **Difficulty:** [Low / Medium / High]

---

### 2. [Draft Title]

- **Trend signal:** [...]
- **Will's angle:** [...]
- **Audience pain:** [...]
- **Difficulty:** [Low / Medium / High]

---

[Repeat for each idea]

---

## Patterns Spotted

[2–3 bullets on what's broadly trending in the niche right now — useful context for future scripting]

## Gaps Worth Owning

[1–2 bullets on problems Will's audience has that aren't being well covered — potential first-mover territory]
```

---

## Quality Check

Before saving, confirm:

- [ ] Every idea maps to a real problem from `clients.md` — nothing generic
- [ ] Each title uses Will's voice — no hype, no hustle language
- [ ] Will's angle is specific — "here's what I've seen with clients" not "here's what you should do"
- [ ] Trend signal is based on actual search findings, not assumption
- [ ] Difficulty rating is honest — Low means Will can record this from memory
- [ ] The Gaps section has at least one genuine opportunity, not just a reframe of existing ideas
