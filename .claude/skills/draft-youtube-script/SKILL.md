---
name: draft-youtube-script
description: Draft a structured YouTube script outline for a 10-12 minute video aimed at small business founders. Use when asked to "script a video", "draft a YouTube script", "turn this into a video", or when given a client conversation or coaching story to turn into content.
disable-model-invocation: true
argument-hint: [brain dump, client story, or topic brief]
---

# Draft YouTube Script

Takes a brain dump — a client conversation, a coaching story, a problem and solution — and turns it into a structured bullet-point outline ready to record from.

Output is a presentation-style outline: enough structure to keep you on track, loose enough to stay authentic.

---

## Inputs

- **Brain dump:** `$ARGUMENTS` — a verbal walkthrough, client story, coaching conversation, key learnings, analogies, or any combination. The messier the better.
- **No additional prep needed.** Will's voice, analogies, and specific language from the brain dump should be preserved in the outline.

---

## Voice and Style

Pull from `context/business/voice.md`. Key rules for this format:

- **Guide not guru** — "here's what I saw with a client" not "here's what you must do"
- Plain language. If Will used an analogy or metaphor in the brain dump, keep it.
- Calm, grounded, practical — like a trusted advisor explaining something over coffee
- Short punchy bullets. No essay sentences.
- "Architect" framing where relevant — founders building the business, not running it

What to avoid:
- Hustle language ("10x", "crush it", "grind", "beast mode")
- Guru positioning ("you need to", "the secret is", "most people don't know")
- Vague opener lines ("In today's video we're going to talk about...")
- Long wind-down before the CTA — get straight to it
- AI-sounding phrasing — it should sound like Will talking, not a script

---

## Target Audience

Small business founders with 3–20 employees. Profitable but stretched. Still too operational. Want to grow without burning out. Curious about systems and AI but don't know where to start. Resonate with calm, experience-based advice — not hype.

---

## Structure

Every script follows this exact structure — no exceptions:

1. **Hook** (0:00–0:10) — Strong promise. The viewer knows exactly what they're getting.
2. **Intro / Credibility** (0:10–1:00) — Brief context that earns the next 10 minutes.
3. **Point 1** — First talking point with supporting stories and sub-bullets.
4. **Point 2** — Second talking point with supporting stories and sub-bullets.
5. **Point 3** — Third talking point with supporting stories and sub-bullets.
6. **End Screen CTA** — Short, direct. No gradual wind-down.

**Always exactly 3 talking points.** No more, no fewer.

---

## Process

**Step 1: Extract the core**
Read the brain dump and identify:
- The central problem the audience has (what pain does this video address?)
- The 3 main learnings or takeaways (these become the 3 points)
- Any specific stories, client situations, or examples
- Any analogies, metaphors, or specific phrases Will used — flag these to preserve

**Step 2: Write the Hook**
One to two bullets. The hook is a promise — state the problem or payoff directly.
- What is the viewer going to get from watching this?
- Make it specific enough that the right person leans in
- Do NOT start with "In today's video..." — start with the problem or the outcome
- Pattern interrupts work well: a counterintuitive statement, a question, a bold observation

**Step 3: Write the Intro / Credibility**
Two to four bullets:
- Who this is for (make the audience feel seen — "if you're a founder who still handles most of the sales yourself...")
- Brief credibility — ground this in reality (a client conversation, a pattern seen repeatedly, a real situation)
- Reinforce the promise — what they'll take away by the end

**Step 4: Build the 3 Talking Points**
For each point:
- Name the point clearly (short, memorable)
- One bullet stating the core idea
- Two to four sub-bullets with the story, example, or evidence from the brain dump
- Use Will's specific language and analogies where they appeared
- Close each point with a single actionable or reflective takeaway

**Step 5: Write the End Screen CTA**
Two to three bullets maximum:
- One-line close (thanks for watching, brief callback to what was covered)
- Single CTA — "if you want to work through this in your business, book a call — link in the description"
- Nothing else. No "like and subscribe" pitch. No gradual sign-off.

**Step 6: Research trending YouTube titles in the niche**
Search YouTube for videos currently getting traction with small business founders. Run 2–3 searches using terms that overlap with the video topic — e.g. "small business owner sales system", "founder delegation", "business owner AI tools", "how to scale small business". Look for:
- What title formats are getting clicks (question format, "how I", "why you", "the real reason", number lists)
- What specific pain points are being packaged as titles
- What framing angles are working — same problem, different angle
- Any patterns in what's performing well vs. what looks generic

Do not copy titles. Use the patterns to inform framing. The goal is to understand how the niche is currently talking about this problem — then write titles that fit Will's voice while riding the same current.

**Step 7: Suggest trend-informed titles**
Write 3 title options that combine:
- The core story and angle from the brain dump
- The framing patterns currently getting traction on YouTube
- Will's voice — specific, calm, no hype

For each title, note in one line why it works (what trend pattern it's using, what pain it targets).

**Step 8: Present and save**
Present the full outline in chat.
Save to: `workspace/content/youtube-scripts/{topic-slug}.md`
Confirm: "Script outline saved to workspace/content/youtube-scripts/ — ready to record from or refine further."

---

---

## Output Template

```markdown
# [Working Title]

**Topic:** [One line — the core problem or theme]
**Audience:** Small business founders, 3–20 employees
**Target length:** 10–12 minutes
**Date:** [YYYY-MM-DD]

---

## Hook (0:00–0:10)

- [Bold opening statement, problem, or question — the promise]
- [Optional: a second line that sharpens the hook]

---

## Intro / Credibility (0:10–1:00)

- [Who this is for — make the right person feel seen]
- [Ground it: client conversation, pattern you've seen, real situation]
- [Reinforce the promise — here's what you'll take away]

---

## Point 1: [Name]

- [Core idea in one line]
  - [Story or example from the brain dump]
  - [Detail, analogy, or evidence]
  - [Takeaway]

---

## Point 2: [Name]

- [Core idea in one line]
  - [Story or example from the brain dump]
  - [Detail, analogy, or evidence]
  - [Takeaway]

---

## Point 3: [Name]

- [Core idea in one line]
  - [Story or example from the brain dump]
  - [Detail, analogy, or evidence]
  - [Takeaway]

---

## End Screen CTA (final 15–20 seconds)

- [One-line close — brief, warm, no fluff]
- [Single CTA — book a call / link in description]

---

## Title Options

1. [Option 1] — *[Why it works: trend pattern used + pain targeted]*
2. [Option 2] — *[Why it works: trend pattern used + pain targeted]*
3. [Option 3] — *[Why it works: trend pattern used + pain targeted]*
```

---

## Quality Check

Before presenting, confirm:

- [ ] Hook is specific — a founder who has this problem would immediately lean in
- [ ] Exactly 3 talking points — not 2, not 4
- [ ] Will's specific language, analogies, and metaphors are preserved where they appeared
- [ ] Each point has a clear takeaway — not just explanation, but something to act on or reflect on
- [ ] End screen is short and direct — no gradual wind-down
- [ ] Sounds like Will talking, not an AI writing
- [ ] No hustle language, no guru positioning, no vague opener
- [ ] Title options are specific to the pain or outcome — not generic
- [ ] Each title option is informed by a trending format or framing pattern — with a rationale noted
