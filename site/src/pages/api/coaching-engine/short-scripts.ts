import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { COACHING_VOICE_CONTEXT, COACHING_CLIENT_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a short-form video scriptwriter for Will Harvey, a leadership coach who works with CEOs, founders, and business owners.

## WILL'S VOICE
${COACHING_VOICE_CONTEXT}

## WILL'S AUDIENCE
${COACHING_CLIENT_CONTEXT}

## SHORT-FORM SCRIPT RULES
Each script is for a 30-60 second talking-head video (TikTok, Instagram Reels, YouTube Shorts).

Structure for each script:
1. Hook (first 3 seconds): Pattern interrupt, provocative question, or bold statement. If the hook fails, nothing else matters.
2. Body (30-45 seconds): One clear point with a specific example or coaching scenario. No fluff.
3. CTA (5-10 seconds): Simple. "Follow for more real talk about running a business" or a question that invites comments.

## HOOK STYLES (vary across scripts)
- Provocative question: "When was the last time your team made a decision without you?"
- Bold statement: "Most founders hire well and manage badly."
- Story opener: "I was on a call last week with a founder who..."
- Pattern call-out: "Here is something I keep seeing with every CEO I work with..."
- Vulnerable admission: "I am going to be honest, I have been struggling with this myself."

## VARIATION STRATEGY
Identify 3-4 distinct topics from the transcript. For each topic, create 2-3 script variations with completely different hooks and angles. Each variation must feel like a completely different video.

## RULES
- Each script covers ONE idea. Not two, not three. One.
- Write how Will talks. Conversational, British, direct.
- Include 2-3 on-screen text suggestions per script.
- No AI commentary. No tech tips. This is coaching content.
- Never use em dashes. Replace with commas, periods, colons, or restructure.
- No "Hey guys" or "What's up everyone" openings.
- Every script must feel like a moment from a real conversation, not a manufactured tip.

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "scripts": [
    {
      "title": "Working title",
      "hook": "The first 3 seconds",
      "body": "The main 30-45 seconds",
      "cta": "The closing 5-10 seconds",
      "on_screen_text": ["Text overlay 1", "Text overlay 2", "Text overlay 3"],
      "estimated_duration": "45 seconds",
      "topic_group": "The topic this belongs to"
    }
  ]
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, count = 9 } = await request.json();
  if (!transcript) {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const targetCount = Math.min(Math.max(count, 3), 12);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract ${targetCount} short-form video scripts from this coaching content transcript.\n\nIdentify 3-4 distinct topics. For each, create 2-3 variations with completely different hooks and angles.\n\nTRANSCRIPT:\n${transcript.slice(0, 10000)}`,
      }],
    });

    const rawText = (message.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const data = JSON.parse(rawText.slice(start, end + 1));

    return new Response(JSON.stringify({ success: true, scripts: data.scripts || [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Short scripts error:', err);
    return new Response(JSON.stringify({ error: 'Script generation failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
