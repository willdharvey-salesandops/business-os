# Skill: Reply Categorisation Logic

Used by: Reply Handler agent

This skill defines how to read and categorise incoming replies, what signals indicate each category, how to handle edge cases, and what auto-handling rules apply.

---

## The 7 Categories

### 1. Interested
**Definition**: The prospect shows genuine curiosity, asks a clarifying question, suggests a call, or indicates they want to learn more.

**Signals**:
- "I'd be open to a call"
- "Can you tell me more about X?"
- "How does this work?"
- "What does working with you look like?"
- "Can you send me more information?"
- "When are you free?"
- Asks about pricing, timelines, or process

**Auto-handle**: No. Always draft a response and present to user.

---

### 2. Not Now
**Definition**: The prospect is not hostile but is genuinely not in a position to engage right now. Often provides a timeframe.

**Signals**:
- "Reach out to me in [month/quarter/year]"
- "We're mid-project right now, check back in X months"
- "Budget is locked until [period]"
- "I'm heading out on leave — try me in [month]"
- "This is on our roadmap for later in the year"
- "Not the right time but keep in touch"

**Auto-handle**: No. Draft a warm, pressure-free response and present to user. Note the follow-up date clearly.

---

### 3. Wrong Person
**Definition**: The prospect has received the email but is not the right contact. May refer to someone else.

**Signals**:
- "You want to speak to [Name] — I'll copy them in"
- "This isn't my area, you should contact [department/name]"
- "I've passed your details to [colleague]"
- "We don't handle this — try [other company or department]"
- "I left [company] — try [successor name/email]"

**Auto-handle**: Yes — with conditions.
- If they named a specific person: draft a reply thanking them and asking to be introduced or for the right contact's details
- If they gave no alternative: send a brief acknowledgement, unsubscribe from sequence, log
- Never just ignore a wrong-person reply

---

### 4. Unsubscribe
**Definition**: Explicit request to stop receiving emails.

**Signals**:
- "Unsubscribe me"
- "Please remove me from your list"
- "Stop emailing me"
- "Don't email me again"
- "Take me off your list"
- Any clear opt-out request, even if rudely worded

**Auto-handle**: Yes — immediately. No reply unless they asked for confirmation.
- Mark as unsubscribed in Instantly
- Remove from campaign
- Do not re-add to any future campaign for this client without explicit re-permission
- Log with timestamp

---

### 5. Out of Office
**Definition**: Automated OOO response, not a human reply.

**Signals**:
- Contains "out of office" or "out of the office"
- Contains "automatic reply" or "auto-reply"
- Contains "I am currently away" or similar
- Lists a return date
- Signed by an automated system, not the person

**Auto-handle**: Yes.
- Log the return date if mentioned
- Do not reply
- Flag the return date in the report so the user can consider a manual follow-up after they're back
- Do not count as a sequence reply — the human hasn't seen the email yet

---

### 6. Negative / Hostile
**Definition**: The prospect is angry, rude, or aggressive. Tone is clearly negative even if they haven't explicitly requested removal.

**Signals**:
- Insulting or aggressive language
- "This is spam"
- "How did you get my email?"
- "Don't ever contact me again" (even if phrased rudely)
- Threatening language
- Legal references (GDPR, CAN-SPAM, etc.)

**Auto-handle**: Never. Always escalate to user.
- Pause the prospect in the campaign sequence immediately
- Do not auto-reply under any circumstances
- Present the full reply to the user with context
- Suggest options: apologise and unsubscribe, check compliance, or simply unsubscribe without reply

If there are legal references (GDPR, "right to erasure", "data request"), flag as urgent and recommend taking it seriously.

---

### 7. Ambiguous
**Definition**: The reply is unclear — could be read as multiple categories.

**Signals**:
- Very short replies with no clear intent ("ok", "sure", "thanks")
- Replies that seem related but are confusing
- Replies in another language
- Thread context makes the meaning unclear

**Auto-handle**: No. Present to user with:
- Your best guess at the category (and why)
- The alternative interpretation
- The full reply text
- A recommended draft if the most likely category warrants one

---

## Edge Cases

**Reply contains multiple signals**: Prioritise the highest-friction category. If they're interested AND mention GDPR, treat as Negative/Hostile first — resolve that before engaging.

**Non-English replies**: Translate to English, flag that it's a translation, then categorise.

**Reply to a follow-up email**: The person saw multiple emails. Consider that in your draft — acknowledge you've been in touch a few times.

**Reply from a different email address**: The prospect replied from a personal or alternative email. Note this — it may affect deliverability and record-keeping.

---

## Processing Sequence

1. Retrieve reply via Instantly API
2. Read full reply text (and thread context if available)
3. Apply category logic above
4. For auto-handle categories: execute immediately, log
5. For draft categories: write draft, present to Orchestrator
6. Update reply status in Instantly to prevent re-processing
7. Include in daily reply report
