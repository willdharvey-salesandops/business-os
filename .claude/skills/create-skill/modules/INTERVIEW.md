# Interview Module

A structured conversation to gather everything needed to build a skill well.

---

## How to Run This Interview

Work through the questions in order. Ask one section at a time — don't front-load all questions at once. Wait for the answer before moving on.

If an answer is vague, ask a clarifying follow-up before continuing. The more precise the answers, the better the skill.

At the end, summarise back what you heard and confirm before building.

---

## Section 1: The Task

**Ask:**

> "What's the task or activity you want to turn into a skill? Describe it like you're explaining it to someone who's never seen you do it."

**What you're listening for:**
- The goal — what outcome does this produce?
- The trigger — what situation makes you reach for this?
- The complexity — is it a single action or a multi-step process?

**If the answer is too vague**, ask:
> "Can you walk me through what you'd actually do, step by step, from start to finish?"

---

## Section 2: The Trigger

**Ask:**

> "When do you use this? What's happening in the business, or what would you say to me, that would make you want this skill to run?"

**What you're listening for:**
- Specific phrases the user would naturally say
- Situations or contexts (end of week, after a sales call, when onboarding a client)
- Whether it should run automatically (Claude detects the trigger) or always manually (user invokes it directly)

**Follow-up if needed:**
> "Would you want Claude to recognise when to use this automatically — or would you always kick it off yourself?"

---

## Section 3: The Inputs

**Ask:**

> "What information does Claude need to do this well? What would you give it when you kick it off?"

**Common inputs for non-coding skills:**
- A name (client name, project name)
- A document or notes to work from
- A URL or reference material
- A brief or set of instructions
- Context about the situation (e.g., "this is a cold outreach")
- No inputs at all (e.g., a weekly summary generated from existing files)

**Follow-up if needed:**
> "Is there anything about your business, your clients, or your voice that Claude should already know when running this — or does it need you to provide it each time?"

---

## Section 4: The Output

**Ask:**

> "What does a great result look like? Walk me through the format, the length, and where it ends up."

**What you're listening for:**
- Output format (markdown doc, email draft, bullet list, table, structured plan)
- Output length (quick summary vs. detailed document)
- Save location (which folder in `workspace/`?)
- Whether it should be shown in chat or saved to a file

**If they struggle to describe it:**
> "Think of the last time you did this manually. What did you produce? What did you hand over or act on?"

---

## Section 5: The Standard

**Ask:**

> "What makes a version of this genuinely useful — versus one that's technically correct but you'd need to redo it? What are the things it must get right?"

**What you're listening for:**
- Non-negotiable quality standards
- Things that have gone wrong before (format, tone, missing info)
- Specific patterns or structures that must be followed
- Examples of good vs. bad output (if they have them)

---

## Section 6: The Name

**Ask:**

> "What would you call this? What name would make you instantly know what it does when you see it in a list of skills?"

**Naming rules to apply:**
- Lowercase only
- Hyphens instead of spaces
- Max 64 characters
- Should describe the action, not the concept (e.g., `write-linkedin-post`, not `content-skill`)

**Suggest a name based on what you've heard** and confirm:
> "I'd call this `{suggested-name}` — does that feel right?"

---

## Section 7: Confirm

Before building, feed back a summary:

---

**Summary for confirmation:**

> "Here's what I've got:
>
> **Skill name:** `{name}`
> **Type:** {Workflow / Content / Research / Analysis / Communication / Planning}
> **Trigger:** {What the user says or what situation kicks it off}
> **Inputs:** {What Claude needs to run it}
> **Output:** {What gets produced, and where it's saved}
> **Quality standard:** {What must it get right}
>
> Does that match what you had in mind?"

Wait for confirmation before moving to Step 3 (Build the Skill).

If they want to change something, update the summary and confirm again. Don't build until the summary is approved.
