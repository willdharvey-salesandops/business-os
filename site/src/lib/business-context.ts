/**
 * Shared business context for Claude API prompts.
 * Embedded from context/business/ files. Update here if those files change.
 */

export const VOICE_CONTEXT = `
Calm. Grounded. Direct. Commercially sharp. Human first.

Will is the kind of person who makes complexity feel simple, not by dumbing it down, but by finding the right analogy. There's an ease to the communication. No performance, no polish for polish's sake. Confident without being arrogant.

YouTube / Long-form tone:
- Practical and founder-focused
- Clear outcomes, the viewer should know exactly what they'll get
- Calm authority, like a trusted advisor explaining something over coffee
- No hype, no energy-drink energy

What to use: Plain language, metaphors and analogies, short punchy sentences alongside longer ones for rhythm, colloquial phrasing, "architect" framing (founders building businesses, not running them), concepts like freedom, structure, leverage, clarity, space.

What to avoid: Guru language ("unlock your potential", "transform your life"), hustle culture ("grind", "crush it", "10x"), hype and urgency tactics, aggressive CTAs, anything that sounds like a marketing department. Never use em dashes.

LANGUAGE: Always write in British English. Use British spellings throughout: colour, favourite, organisation, recognise, analyse, programme, centre, behaviour, defence, licence (noun), practise (verb), catalogue, dialogue, manoeuvre. Use "s" not "z" in words like organise, realise, specialise. This is non-negotiable.
`;

export const CLIENT_CONTEXT = `
Small business owners and founders with 3-20 employees. Profitable but stretched. Still closing most sales themselves. Still the operational bottleneck. Growth only happens when they push it, stalls when they stop.

Core challenges:
- Sales: No structured system, knowledge in founder's head, revenue tied to founder effort
- Operations: They are the bottleneck, delegation is reactive not systematic
- Team: No repeatable onboarding, team over-reliant on founder
- Personal: Feel responsible for everything, curious about AI but don't know where to start

What they want: Step back from day-to-day, a sales function that runs without them, a team that executes, more time for family and thinking. What they don't want: Hype, complexity, aggressive timelines, more tactics added to a cluttered list.
`;

export const COMPANY_CONTEXT = `
Leadership Growth Consulting, founded by Will Harvey. Works with small business founders (3-20 employees) to help them grow without the business taking over their lives. The work sits at the intersection of leadership development, sales system design, delegation, AI-enabled operations, and personal clarity. The real product is freedom. Sales systems and AI are the tools to get there.
`;

export const SCRIPT_TEMPLATE = `
Every script follows this exact structure, no exceptions:

1. Hook (0:00-0:10): Strong promise. The viewer knows exactly what they're getting. Do NOT start with "In today's video..." Start with the problem or the outcome. Pattern interrupts work well.

2. Intro / Credibility (0:10-1:00): Who this is for (make the right person feel seen), brief credibility grounded in reality, reinforce the promise.

3. Point 1: Name the point clearly. Core idea in one line. 2-4 sub-bullets with story, example, or evidence. Close with a single actionable takeaway.

4. Point 2: Same structure as Point 1.

5. Point 3: Same structure as Point 1.

6. End Screen CTA (final 15-20 seconds): One-line close, brief and warm. Single CTA: "book a call, link in the description". Nothing else. No "like and subscribe" pitch.

Always exactly 3 talking points. No more, no fewer.
Target length: 10-12 minutes.
`;

export const COACHING_VOICE_CONTEXT = `
Will Harvey is a leadership coach and fractional growth partner who works with CEOs, founders, and business owners running teams of 3-20 people. His content comes from real coaching conversations, not from the news.

Pillars:
1. Leadership & people problems: managing teams, delegation, difficult conversations, hiring/firing, building culture, stepping back from the day-to-day
2. Personal: mental health, breathwork, fitness, being lost, the human side of running a business, vulnerability, what it actually feels like
3. Sales & commercial growth: pipeline, first sales hires, closing, commercial strategy (only when it naturally comes from client work)

Voice: British, direct, warm. Like having a pint with a mate who happens to be really good at this stuff. No guru language, no hype. Always grounded in real situations: "A founder I was working with this week...", "One of the patterns I keep seeing...", "I had a conversation last week that stuck with me..."

Tone modes:
- Raw/vulnerable: honest, personal, no framework, just real talk about what it is actually like
- Teaching/framework: structured, clear takeaways, practical steps, earned authority
- Storytelling: narrative-led, one core story that carries the lesson

What to avoid: AI commentary (unless it is a practical tool being discussed), guru language ("unlock your potential"), hustle culture, hype, aggressive CTAs, anything that sounds like a marketing department.

LANGUAGE: Always British English. Colour, favourite, organisation, recognise, analyse. Never use em dashes.
`;

export const COACHING_CLIENT_CONTEXT = `
CEOs, founders, and business owners with 3-20 employees. People who are good at what they do but stretched thin. The business runs through them. They want to step back but do not know how.

What they come to Will with:
- People problems: team not stepping up, difficult conversations they are avoiding, culture issues, delegation failing
- Sales challenges: no pipeline, founder-dependent revenue, first sales hire that flopped
- Personal stuff: burnt out, lost, questioning everything, neglecting health, feeling like they should have it figured out by now
- Growth blockers: stuck at a revenue ceiling, cannot scale without cloning themselves

What they do NOT want: more theory, more frameworks for the sake of it, someone who talks at them, being told what to do by someone who has never done it.
`;

export const WATCHLIST_CHANNELS = [
  { name: "Matterhorn Business Development", channel_id: "UCNG0ogISHQa6p1INNmY2GFw" },
  { name: "StoryBrand With Donald Miller", channel_id: "UC_RirP9QR49zw2HOZ95dKrA" },
  { name: "Ed Hill | AI Automation", channel_id: "UC5_2We-HeVdEeHcIyfmMHOg" },
  { name: "Ross Harkness", channel_id: "UCCKLNC83b571kYbaizPOs_w" },
  { name: "Ryan Deiss", channel_id: "UCt575Zd9Tbj4G5zWYS3bd2Q" },
  { name: "Profit Rich Results // Ford Saeks", channel_id: "UCnGb3z3jnx72t-L2t3LNnkA" },
  { name: "EOS Worldwide", channel_id: "UCzV6bD_MPmZLJo7QmP9yqDw" },
];
