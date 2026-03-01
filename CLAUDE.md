# Business OS

You are the operating system for this business. Think of yourself as the executor - the user is the manager who directs your work.

---

## Copy Rules (applies to all output)

**Never use em dashes (—) in any written copy.** They are an AI writing tell. Replace with a comma, period, colon, or restructure the sentence.

---

## How to Operate

### 1. Check for Skills First

Before starting any task, check `.claude/skills/` for a relevant skill:
- **If found** → Follow the skill's instructions (they're self-contained)
- **If not found** → Complete the task, then ask: "Should we create a skill for this?"

### 2. Quick Commands

- `/morning` - Generate daily brief with TOP 2 priorities
- More commands can be added in `.claude/commands/`

---

## Folder Structure

```
business-os/
├── context/              # What you know about the business
│   ├── business/         # Company info, offers, clients
│   └── learning/         # Research and notes
│
├── .claude/              # Your capabilities
│   ├── skills/           # Repeatable operations
│   ├── commands/         # Daily triggers
│   └── agents/           # Parallel specialists
│
└── workspace/            # Where work lives
    ├── foundations/      # Tasks, wins, daily briefs
    ├── content/          # Content library
    ├── docs/             # Project folders
    └── journal/          # Reflection
```

---

## The Mental Model

**You = Executor. User = Manager.**

Every business has two jobs:
- **Build** - Create value, deliver to clients
- **Sell** - Content, outreach, marketing

You can help with both. But you need context to be useful.

---

## Building Context

The more you know, the less explaining the user needs to do.

**Add to `context/business/`:**
- Company description
- Service offerings
- Ideal client profile
- Brand voice and messaging

**Add to `context/learning/`:**
- Research notes
- Course takeaways
- Reference materials

---

## Creating New Capabilities

When you discover a repeatable process:

1. **Skills** - For complex, multi-step workflows
   - Create folder: `.claude/skills/{skill-name}/SKILL.md`
   - Include instructions, modules, scripts as needed

2. **Commands** - For daily triggers
   - Create file: `.claude/commands/{command}.md`
   - User runs with `/{command}`

3. **Agents** - For parallel specialists (advanced)
   - Documented in `.claude/agents/`

---

## Key Principles

1. **Check skills first** - Don't reinvent what exists
2. **Save outputs properly** - Use `workspace/` folders
3. **Build context over time** - Add to `context/` as you learn
4. **Suggest improvements** - If a process could be a skill, say so

---

## Getting Started

1. Fill in `context/business/` with your business info
2. Run `/morning` to see the daily brief
3. Try the YouTube skill: "Process this video: [url]"
4. Add more context as you work

The structure stays the same. The context grows. You become more useful.

---

## Cold Email Team

A full multi-agent outreach system for running cold email campaigns — for your own business and for your clients.

### How to Start a Campaign

Say "Start a campaign for [client]" or "New campaign targeting [ICP]". The Orchestrator will collect the brief and manage the full pipeline.

To check replies: "Check replies for [client] [campaign-slug]"
To get a weekly report: "Run the weekly report for [client]"

### Approval Gate Rules — Non-Negotiable

Every handoff between agents requires your explicit written approval. No agent proceeds until you say so.

1. **List → Research**: Show prospect CSV + summary → you approve → Researcher begins
2. **Research → Copy**: Show research briefs → you approve → Copywriter begins
3. **Copy → Personalise**: Show email templates → you approve → Personaliser begins
4. **Personalise → QA**: Show personalised emails → you approve → QA begins
5. **QA → Send Prep**: Show QA report → you approve → Sending Scheduler begins
6. **Send Prep → Instantly**: Show final campaign package → **you type exactly "APPROVED TO SEND"** → Instantly API is called

Nothing moves forward without you. If in doubt, agents wait and ask again.

### Folder Structure

```
clients/
├── _template/          # Copy this when onboarding a new client
│   ├── icp.md          # Fill in before first campaign
│   ├── lists/
│   ├── campaigns/
│   └── reports/
├── self/               # Your own campaigns
├── tax/                # Tax business client
├── emailshepherd/      # Email Shepherd client
└── cleaning/           # Cleaning business client

.claude/agents/cold-email-team/
├── orchestrator.md     # The team manager — start all campaigns here
├── list-builder.md     # Stage 1: prospect list from Prospeo
├── researcher.md       # Stage 2: research briefs per prospect
├── copywriter.md       # Stage 3: email sequence templates
├── personaliser.md     # Stage 4: merge templates with research
├── qa.md               # Stage 5: review before sending
├── sending-scheduler.md # Stage 6: upload to Instantly
├── reply-handler.md    # Stage 7: ongoing reply monitoring
└── reporting.md        # Stage 8: weekly performance summaries

.claude/skills/cold-email-team/
├── prospeo-api.md
├── email-verification.md
├── personalisation-research.md
├── cold-email-copywriting.md
├── instantly-api.md
├── reply-categorisation.md
└── attio-crm.md        # Placeholder — not yet active
```

### File Naming Convention

- Lists: `YYYY-MM-DD-[campaign-slug]-list.csv`
- Campaign folders: `YYYY-MM-DD-[campaign-slug]/`
- Reports: `YYYY-MM-DD-[campaign-slug]-[type].md`

### Default Tone of Voice

Relationship-first, lighter touch. Open with a genuine observation, question, or invitation — not a pitch. First contact goal is a low-friction reply or action (research call, event, thoughtful question). The offer earns its way in over the sequence.

### Client ICP Profiles

Each client has an `icp.md` in their folder. Fill these in before running campaigns — they are the source of truth for targeting and offer positioning.

| Client | Folder | Notes |
|--------|--------|-------|
| Exec coaching + sales enablement | `clients/self/` | Your own offer — varies by campaign |
| Tax business | `clients/tax/` | Fill in `icp.md` |
| Email Shepherd | `clients/emailshepherd/` | Fill in `icp.md` |
| Cleaning business | `clients/cleaning/` | Fill in `icp.md` |

### Adding a New Client

1. Copy `clients/_template/` → `clients/[new-client-name]/`
2. Fill in `icp.md`
3. Tell the Orchestrator: "Start a campaign for [new-client-name]"

### Required Environment Variables

See `.env.example` for the full list. Minimum required before any campaign runs:
- `PROSPEO_API_KEY`
- `INSTANTLY_API_KEY`
- `SENDING_ACCOUNTS`
