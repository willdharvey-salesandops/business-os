import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_CONTEXT, CLIENT_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a short-form video scriptwriter for Will Harvey's brand, Leadership Growth Consulting.

## WILL'S VOICE
${VOICE_CONTEXT}

## WILL'S AUDIENCE
${CLIENT_CONTEXT}

## SHORT-FORM SCRIPT RULES
Each script must be designed for a 30-60 second talking-head video (TikTok, Instagram Reels, YouTube Shorts).

Structure for each script:
1. Hook (first 3 seconds): Pattern interrupt or provocative statement. This is the most important part. If the hook fails, nothing else matters.
2. Body (30-45 seconds): One clear point with a specific example or scenario. No fluff, no preamble.
3. CTA (5-10 seconds): Simple, low-friction. "Follow for more" or "Link in bio" or a question that invites comments.

## VARIATION STRATEGY
Identify 3-4 distinct topics/angles from the transcript. For each topic, create 3 script variations with different hooks, framings, or entry points. This gives 9-12 total scripts. Group them by topic in the output.

For example, if the transcript covers "delegation" and "AI tools", you'd create:
- 3 scripts about delegation (different hooks, different examples)
- 3 scripts about AI tools (different hooks, different examples)

Each variation must feel like a completely different video, not a slight remix. Different hook style, different example, different emotional angle.

Rules:
- Each script covers ONE idea only. Not two, not three. One.
- Use conversational language. Write how people talk, not how they write.
- Include 2-3 on-screen text suggestions (key phrases that appear as text overlays).
- The hook must work WITHOUT context. Someone scrolling should stop immediately.
- Never use em dashes. Replace with commas, periods, colons, or restructure the sentence.
- No "Hey guys" or "What's up everyone" openings.
- Scripts should feel like different videos, not a series. Each stands alone.

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "scripts": [
    {
      "title": "Working title for internal reference",
      "hook": "The first 3 seconds spoken aloud",
      "body": "The main 30-45 seconds of content",
      "cta": "The closing 5-10 seconds",
      "on_screen_text": ["Text overlay 1", "Text overlay 2", "Text overlay 3"],
      "estimated_duration": "45 seconds",
      "topic_group": "The topic this script belongs to"
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

    const userPrompt = `Extract ${targetCount} short-form video scripts from this transcript.

Identify 3-4 distinct topics from the transcript. For each topic, create 3 script variations with completely different hooks and angles. That should give ${targetCount} total scripts.

Make the hooks irresistible. Each variation must feel like a completely different video.

TRANSCRIPT:
${transcript.slice(0, 10000)}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
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
