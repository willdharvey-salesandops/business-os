---
name: create-skill
description: Create a new skill from a description of a repeatable business task. Use when the user wants to turn a recurring workflow, process, or activity into a reusable skill that Claude can execute reliably every time. Triggers include "create a skill", "build a skill", "make this repeatable", "turn this into a skill", "add a skill for", "capture this process".
disable-model-invocation: true
allowed-tools: Write, Read, Glob
argument-hint: [skill name or brief description]
---

# Create Skill

Turn a repeatable task into a reliable skill Claude can execute every time.

---

## What This Skill Does

Walks through a structured interview to understand a business task, then builds a complete skill — the right type, with the right structure, ready to use immediately.

Input: A description of something you do repeatedly
Output: A fully built skill in `.claude/skills/{skill-name}/`

---

## Step 1: Run the Interview

Follow the interview process in [INTERVIEW.md](modules/INTERVIEW.md).

Work through every question. Do not skip ahead. The quality of the interview determines the quality of the skill.

Take the user's answers and hold them — you'll use them in Step 3.

---

## Step 2: Classify the Skill Type

Based on the interview, identify the type using this table:

| Type | What it does | Example |
|------|-------------|---------|
| **Workflow** | Executes a multi-step process with a clear outcome | Client onboarding, sending a proposal |
| **Content** | Creates a specific piece of writing or document | LinkedIn post, email sequence, strategy doc |
| **Research** | Gathers, organises, and summarises information | Competitor analysis, market research |
| **Analysis** | Reviews existing material and extracts insight | Reviewing a sales call transcript, audit |
| **Communication** | Drafts outreach, follow-ups, or structured messages | Cold email, follow-up sequence |
| **Planning** | Produces a structured plan, schedule, or priority list | Weekly plan, project roadmap, action list |

If it doesn't fit cleanly, choose the closest type and note the difference.

---

## Step 3: Build the Skill

Use the matching template from [TEMPLATES.md](modules/TEMPLATES.md).

When building:

1. **Choose a name** — lowercase, hyphens only, max 64 chars. Should be obvious what it does (e.g., `weekly-review`, `client-proposal`, `linkedin-post`).

2. **Write the description** — this is what Claude reads to decide when to use it automatically. Make it specific. Include phrases the user would naturally say. Include "Use when..." phrasing.

3. **Set the right frontmatter** — use `disable-model-invocation: true` for any skill with side effects (creates files, sends messages, takes action). Leave it off for reference skills that Claude should pull in automatically.

4. **Write the workflow** — numbered steps, clear language, no jargon. Each step should tell Claude exactly what to do. Include verification steps at the end so the output can be checked.

5. **Add the output template** — if the skill produces a document or structured output, include the exact template. This removes ambiguity.

6. **Add supporting modules** — if the skill is complex, break it into modules in a `modules/` subfolder and reference them from SKILL.md.

---

## Step 4: Create the Files

Create the directory and files:

```
.claude/skills/{skill-name}/
├── SKILL.md                    # Required — main skill file
└── modules/                    # Optional — for complex skills
    └── {MODULE-NAME}.md
```

Use the Write tool to create each file with the content built in Step 3.

---

## Step 5: Confirm with the User

After creating the files, confirm:

1. Show a summary of what was created — name, type, trigger, output location
2. Tell them how to invoke it — `/skill-name` or what they'd say to trigger it automatically
3. Ask: "Does this match what you had in mind, or should we adjust anything?"

If adjustments are needed, update the files. Don't start over — edit precisely.

---

## Skill Quality Checklist

Before finishing, verify the skill passes these checks:

- [ ] The name is obvious and easy to remember
- [ ] The description uses natural trigger phrases the user would actually say
- [ ] Each step tells Claude what to do, not just what to think about
- [ ] The output format is defined — no ambiguity about what gets produced
- [ ] The output save location is specified (if the skill creates a file)
- [ ] `disable-model-invocation: true` is set if the skill takes action or creates files
- [ ] The language is plain, direct, and matches the business voice (no jargon)
- [ ] A new user could follow the skill without needing to ask questions

---

## Output Location

All generated skills are saved to: `.claude/skills/{skill-name}/SKILL.md`

Complex skills may include: `.claude/skills/{skill-name}/modules/`
