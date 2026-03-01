# Skill Templates

Ready-to-use templates for each skill type. Copy the matching template and fill in the bracketed sections based on the interview.

---

## How to Use These Templates

1. Choose the template that matches the skill type identified in Step 2
2. Replace every `{placeholder}` with the actual content from the interview
3. Remove any sections that don't apply
4. Add any sections that are specific to this skill

The description field is the most important part. Write it like you're telling Claude when to reach for this tool.

---

## Template 1: Workflow Skill

*Use for: multi-step processes with a clear start, middle, and end. Client onboarding, project kickoffs, end-of-week reviews.*

```markdown
---
name: {skill-name}
description: {What this workflow does and when to use it. Include natural trigger phrases. Example: "Run the client onboarding process. Use when a new client signs, when onboarding needs to start, or when asked to set up a new client."}
disable-model-invocation: true
allowed-tools: Write, Read, Glob
argument-hint: [{main input — e.g., client name, project name}]
---

# {Skill Title}

{One sentence describing what this workflow produces and why it matters.}

---

## Inputs Required

- **{Input 1}:** {What it is and where to find it}
- **{Input 2}:** {What it is and where to find it}
- **{Input 3}:** {What it is and where to find it — or "None needed"}

---

## Workflow

**Step 1: {Step name}**
{Exactly what to do. Be specific. No vague instructions like "review the information" — say "Read the brief at workspace/docs/{folder}/brief.md and note the client's goals, budget, and timeline."}

**Step 2: {Step name}**
{What to do next.}

**Step 3: {Step name}**
{What to do next.}

**Step 4: Produce the output**
Create {output type} using the template below.

**Step 5: Save and confirm**
Save to: `workspace/{folder}/{file-name}.md`
Confirm with the user: "Done — {output description} saved to workspace/{folder}/."

---

## Output Template

```markdown
# {Output Title}

**Date:** {YYYY-MM-DD}
**{Label}:** {Value}

## {Section 1}
{Content}

## {Section 2}
{Content}

## Next Steps
- [ ] {Action 1}
- [ ] {Action 2}
```

---

## Quality Check

Before saving, confirm:
- [ ] {Quality standard 1 from interview}
- [ ] {Quality standard 2 from interview}
- [ ] All required sections are complete
- [ ] Next steps are specific and actionable
```

---

## Template 2: Content Skill

*Use for: creating a specific piece of writing. LinkedIn posts, email drafts, proposals, strategy documents, scripts.*

```markdown
---
name: {skill-name}
description: {What content this creates and when to use it. Include platform and format. Example: "Write a LinkedIn post from a topic or idea. Use when asked to write a post, create LinkedIn content, or turn an insight into a post."}
disable-model-invocation: true
allowed-tools: Write, Read
argument-hint: [{topic, idea, or brief}]
---

# {Skill Title}

Creates {content type} in {brand voice description} for {platform/context}.

---

## Inputs

- **Topic or brief:** {What the user provides — e.g., a topic, an idea, bullet points, a transcript section}
- **Tone:** {If variable — e.g., "reflective", "practical", "direct"}
- **Any context:** {Optional additional context the user might provide}

---

## Voice and Style

{Key rules for how this content should sound. Pull from context/business/voice.md if relevant.}

- {Rule 1 — e.g., "No buzzwords, no hustle language"}
- {Rule 2 — e.g., "Start with an observation, not a hook"}
- {Rule 3 — e.g., "Short punchy sentences. No more than 3 lines per paragraph."}
- {Rule 4}

What to avoid:
- {Avoid 1}
- {Avoid 2}

---

## Structure

{Describe the structure of the output. Be precise.}

For example:
- **Opening:** {What the first line or section should do}
- **Body:** {How to develop the idea}
- **Close:** {How to end it — CTA, reflection, question}

---

## Process

1. Read the input: `$ARGUMENTS`
2. Identify the core idea in one sentence
3. Draft following the structure above
4. Review against voice guidelines
5. Produce final version

---

## Output

Present the finished {content type} directly in the chat.

{If it should also be saved:}
Save a copy to: `workspace/content/{file-name}.md`

---

## Quality Check

- [ ] Sounds like a real person wrote it, not an AI
- [ ] Matches the voice guidelines above
- [ ] {Quality standard from interview}
- [ ] {Quality standard from interview}
```

---

## Template 3: Research Skill

*Use for: gathering, organising, and summarising information. Competitor research, market analysis, finding patterns across sources.*

```markdown
---
name: {skill-name}
description: {What this researches and why. Example: "Research a competitor or topic and produce a structured summary. Use when asked to look into a company, analyse a market, or gather background on a topic."}
disable-model-invocation: false
allowed-tools: Read, Glob, WebFetch, WebSearch
argument-hint: [{topic, company name, or URL}]
---

# {Skill Title}

Researches {subject} and produces a structured summary saved to `context/learning/`.

---

## Inputs

- **Subject:** `$ARGUMENTS` — {describe what this could be: a company name, topic, URL}
- **Depth:** {Optional — "quick overview" vs. "deep dive"}

---

## Research Process

**Step 1: Gather sources**
{What to look for and where — e.g., "Search for recent articles, company website, LinkedIn page, any case studies."}

**Step 2: Extract key information**
Pull out:
- {Key data point 1}
- {Key data point 2}
- {Key data point 3}
- {Key data point 4}

**Step 3: Identify patterns and insights**
{What to look for beyond surface facts — e.g., "What's their positioning? What gap does this reveal? How does this relate to what we already know?"}

**Step 4: Connect to existing knowledge**
Check `context/` for related notes. Note connections, contradictions, and gaps.

**Step 5: Produce summary**
Use the output template below.

---

## Output Template

```markdown
# {Research Subject}

**Date:** {YYYY-MM-DD}
**Type:** {Company / Market / Topic / Trend}
**Source(s):** {List URLs or references}

## Summary
{2-3 sentence overview of the most important finding}

## Key Facts
- {Fact 1}
- {Fact 2}
- {Fact 3}

## Insights
- **{Insight 1}:** {What it means}
- **{Insight 2}:** {What it means}

## Relevance to Us
- {How this connects to our business, clients, or strategy}

## Questions Raised
- {Question 1}
- {Question 2}

## Related Notes
- Connects to: {file in context/}
```

---

## Output Location

Save to: `context/learning/{topic}/{subject-slug}.md`
```

---

## Template 4: Analysis Skill

*Use for: reviewing existing material and extracting meaning. Sales call transcripts, client feedback, strategy documents, recorded meetings.*

```markdown
---
name: {skill-name}
description: {What gets analysed and what comes out. Example: "Analyse a sales call transcript and extract key insights, objections, and next steps. Use when reviewing a call, processing a recording, or asked to debrief a conversation."}
disable-model-invocation: true
allowed-tools: Read, Write
argument-hint: [{file path or pasted content}]
---

# {Skill Title}

Reviews {input type} and produces a structured {output type}.

---

## Input

{Describe what the user provides — a file path, pasted text, transcript, document.}

`$ARGUMENTS` — {e.g., "path to transcript file, or paste content directly"}

---

## Analysis Framework

Work through the material looking for:

**{Category 1}**
- {What to identify and note}
- {What to look for}

**{Category 2}**
- {What to identify and note}

**{Category 3}**
- {What to identify and note}

**{Category 4 — Patterns}**
- {What recurring themes, signals, or red flags to watch for}

---

## Output Template

```markdown
# {Analysis Title}

**Date:** {YYYY-MM-DD}
**Source:** {File name or description}

## Summary
{2-3 sentences — the headline finding}

## {Category 1}
- {Finding 1}
- {Finding 2}

## {Category 2}
- {Finding 1}
- {Finding 2}

## {Category 3}
- {Finding 1}

## Recommended Actions
- [ ] {Action 1}
- [ ] {Action 2}
- [ ] {Action 3}
```

---

## Output Location

Save to: `workspace/{folder}/{analysis-title}.md`
Confirm with user when complete.
```

---

## Template 5: Communication Skill

*Use for: drafting outreach, follow-ups, or any structured message. Cold emails, client updates, proposal follow-ups, check-ins.*

```markdown
---
name: {skill-name}
description: {What message this creates and the context. Example: "Draft a follow-up email after a discovery call. Use when following up with a prospect, after a first meeting, or asked to write a post-call follow-up."}
disable-model-invocation: true
allowed-tools: Read, Write
argument-hint: [{recipient name or context}]
---

# {Skill Title}

Drafts {message type} for {context/situation}.

---

## Inputs

- **Recipient:** {Name or role — from $ARGUMENTS or from context}
- **Context:** {What happened before this — meeting, introduction, no prior contact}
- **Goal:** {What this message needs to achieve}
- **Tone:** {Refer to voice.md — e.g., direct, warm, structured-but-not-cold}

---

## Message Structure

**Subject line (if email):**
{Rule — e.g., "Clear and specific. No clickbait. References the conversation or context."}

**Opening:**
{Rule — e.g., "Reference something specific from the conversation. Not 'Hope this email finds you well.'"}

**Body:**
{Rule — e.g., "One clear point per paragraph. State the value or next step directly."}

**Close:**
{Rule — e.g., "One clear CTA. Not multiple options. Make it easy to say yes."}

---

## Process

1. Gather context: who they are, what happened, what we want
2. Draft following the structure above
3. Review against voice.md — no jargon, no corporate polish
4. Tighten: remove anything that doesn't earn its place

---

## Output

Present the draft in chat for review.

If approved, save to: `workspace/content/outreach/{recipient-slug}-{date}.md`

---

## Quality Check

- [ ] Subject line is specific, not generic
- [ ] Opening references something real
- [ ] Single clear CTA
- [ ] Sounds human — not templated
- [ ] No filler phrases ("Just checking in", "Hope you're well", "Circling back")
```

---

## Template 6: Planning Skill

*Use for: producing structured plans, priorities, or schedules. Weekly plans, project roadmaps, prioritisation exercises, action lists.*

```markdown
---
name: {skill-name}
description: {What plan this produces and when. Example: "Generate a weekly plan from current tasks and priorities. Use when starting a new week, planning the week ahead, or asked to prioritise."}
disable-model-invocation: {true if manual, false if Claude should detect it}
allowed-tools: Read, Write, Glob
argument-hint: [{week date, project name, or context}]
---

# {Skill Title}

Produces {plan type} based on {input source}.

---

## Inputs

- **{Input 1}:** {Where to find it — e.g., workspace/foundations/tasks.md}
- **{Input 2}:** {e.g., any context the user provides via $ARGUMENTS}
- **{Input 3}:** {e.g., existing deadlines or priorities}

---

## Planning Process

**Step 1: Gather what exists**
Read {relevant files}. Note all current tasks, commitments, and deadlines.

**Step 2: Apply the prioritisation filter**
For each item, ask:
- Is this urgent (time-sensitive this period)?
- Is this important (moves the business forward)?
- Is this a commitment to someone else?

Sort into: **Must do → Should do → Could do → Drop or defer**

**Step 3: Identify the top priorities**
{Rule — e.g., "Choose no more than 3 Must-Dos. If the user picks 5, push back and ask what gets dropped."}

**Step 4: Build the plan**
Use the output template below.

**Step 5: Save and present**
Save to: `workspace/foundations/{file-name}.md`
Present the plan in chat for confirmation.

---

## Output Template

```markdown
# {Plan Title}

**Period:** {Date range}
**Created:** {YYYY-MM-DD}

## Top Priorities
1. {Priority 1} — {Why it matters}
2. {Priority 2} — {Why it matters}
3. {Priority 3} — {Why it matters}

## Full List

### Must Do
- [ ] {Task}
- [ ] {Task}

### Should Do
- [ ] {Task}
- [ ] {Task}

### Deferred
- {Task} — deferred to {when/why}

## Notes
{Any context, blockers, or decisions made during planning}
```

---

## Quality Check

- [ ] No more than 3 Must-Dos
- [ ] Each item is specific enough to act on
- [ ] Deferred items have a reason
- [ ] Plan is realistic for the time period
```

---

## Choosing the Right Template

If the skill doesn't fit cleanly into one type, use this guide:

| Situation | Template to use |
|-----------|----------------|
| The output is a document with sections | Workflow or Content |
| The output is a message to send | Communication |
| The output is a summary of something that exists | Analysis or Research |
| The output is a prioritised list or schedule | Planning |
| It involves multiple rounds of input/output | Workflow |
| It's always triggered by the same event | Workflow with `disable-model-invocation: true` |
| Claude should detect when to use it | Any template, without `disable-model-invocation` |

When in doubt: use Workflow. It's the most flexible.
