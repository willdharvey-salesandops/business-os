---
name: find-outlier-content
description: Find outlier YouTube videos from creators in the niche, analyze why they worked, and adapt them to Will's voice and content style. Use when asked to "find outlier content", "what's performing well", "find viral videos in my niche", "content inspiration", or "find videos to adapt".
argument-hint: [optional focus topic or creator name]
---

# Find Outlier Content

Scans YouTube creators for videos that massively over-performed their channel average, then analyzes what made them work and adapts the angle to Will's voice, audience, and offer.

An "outlier" = a video with 3x+ the channel's median views. That signal means the topic, hook, or angle resonated disproportionately. Worth studying and adapting.

---

## Inputs

- **Focus topic (optional):** `$ARGUMENTS` - a specific topic to narrow the search (e.g. "delegation", "AI for business owners", "sales systems"). If blank, run a broad scan.
- **Business context:** Read `context/business/clients.md`, `context/business/company.md`, and `context/business/voice.md` before starting.

---

## Process

### Step 1: Load context
Read these files and hold in mind throughout:
- `context/business/clients.md` - who the audience is
- `context/business/company.md` - what Will does
- `context/business/voice.md` - how Will sounds

### Step 2: Get the creator list
Check if `workspace/content/creators-watchlist.json` has channels. Two paths:

**If watchlist has channels (typical):**
```bash
YOUTUBE_API_KEY=$(grep YOUTUBE_API_KEY .env | cut -d= -f2) python3 .claude/skills/find-outlier-content/scripts/outlier_finder.py watchlist --watchlist workspace/content/creators-watchlist.json --months 6 --top 5
```

**If watchlist is empty or you need fresh creators:**
```bash
YOUTUBE_API_KEY=$(grep YOUTUBE_API_KEY .env | cut -d= -f2) python3 .claude/skills/find-outlier-content/scripts/outlier_finder.py discover --keywords "small business owner delegation,founder scaling systems,how to stop being the bottleneck" --max-channels 15 --min-subscribers 1000 --max-subscribers 100000
```
Then add the relevant channels to the watchlist and re-run the watchlist scan.

If `$ARGUMENTS` contains a specific creator name, search for their channel first and use the `channel` command directly:
```bash
YOUTUBE_API_KEY=$(grep YOUTUBE_API_KEY .env | cut -d= -f2) python3 .claude/skills/find-outlier-content/scripts/outlier_finder.py channel --channel-id UCxxx --months 12 --top 10
```

### Step 3: Filter outliers for relevance
From the outlier results, drop any that:
- Are in a completely different niche (crypto, drop-shipping, unrelated markets)
- Are motivation/hype content with no substance to adapt
- Are too personality-dependent to reframe (e.g. celebrity collab content)

Keep outliers where the core topic maps to Will's audience and offer areas.

### Step 4: Pull transcripts for the top outliers
For the top 5-8 relevant outliers, pull transcripts using the existing YouTube skill:
```bash
python3 .claude/skills/youtube/scripts/youtube_transcript.py <video_url> --timestamps
```

Focus on the first 2-3 minutes (hook and intro) for analysis.

### Step 5: Analyze each outlier
For each kept outlier, break down:
- **Hook (first 15-30 seconds):** What promise or pattern interrupt did they use?
- **Title pattern:** What format is the title using? (question, "how I", "why you", numbered list, curiosity gap)
- **Core topic:** What problem or desire is this addressing?
- **Structure:** How is the content organized? (story-driven, numbered tips, case study, before/after)
- **Why it over-performed:** What about this specific angle made it resonate more than the creator's other content?

### Step 6: Adapt to Will's voice
For each analyzed outlier, create an adapted version:
- **Will's title:** Reframe the title for Will's voice (calm, grounded, no hype) while preserving the working format
- **Will's angle:** How would Will approach this topic differently? What client story or coaching experience could he draw from?
- **Will's hook:** Rewrite the hook in Will's voice
- **Audience fit:** Which specific problem from `clients.md` does this address?
- **Difficulty:** Low (has a ready client story) / Medium (needs some thought) / High (needs research)

### Step 7: Save and present
Present the adapted ideas in chat.
Save to: `workspace/content/video-ideas/outliers-[YYYY-MM-DD].md`
Confirm: "Found [N] outlier-inspired ideas. Saved to workspace/content/video-ideas/. Want to turn any of these into a full script?"

If Will picks one, hand off to the `draft-youtube-script` skill with the adapted angle as the brain dump.

---

## Output Template

```markdown
# Outlier Content Scan - [YYYY-MM-DD]

**Focus:** [Broad / specific topic]
**Channels scanned:** [N]
**Outliers found:** [N total] / **Adapted:** [N relevant]

---

## Adapted Ideas

### 1. [Will's Title]

**Original:** "[Original title]" by [Creator] ([view count] views, [outlier_score]x channel median)
**URL:** https://youtube.com/watch?v=[video_id]

- **Why it worked:** [1-2 sentences on why this over-performed]
- **Will's angle:** [How Will would approach this differently]
- **Will's hook:** [Rewritten opening in Will's voice]
- **Audience pain:** [Which client problem this maps to]
- **Difficulty:** [Low / Medium / High]

---

### 2. [Will's Title]

[Same format]

---

## Patterns Spotted

[2-3 bullets on what's working across the outliers - title formats, topic angles, structural patterns]
```

---

## Quality Check

Before saving, confirm:
- [ ] Every adapted idea maps to a real problem from `clients.md`
- [ ] Will's titles use his voice - no hype, no guru language
- [ ] Will's angles are specific - grounded in client experience, not generic advice
- [ ] The "why it worked" analysis is based on actual transcript/title analysis, not assumption
- [ ] Difficulty ratings are honest
- [ ] At least 3 adapted ideas made the cut
- [ ] No em dashes in any copy
