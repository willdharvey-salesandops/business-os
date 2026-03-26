import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { COACHING_VOICE_CONTEXT, COACHING_CLIENT_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a newsletter ghostwriter for Will Harvey, a leadership coach who works with CEOs, founders, and business owners.

## WILL'S VOICE
${COACHING_VOICE_CONTEXT}

Will writes like he talks. A bit wide, like a mate telling you about something that came up this week with a client. Stories, honesty, no filler. He is warm but direct. British. He does not write like a marketer. He writes like someone who genuinely gives a shit about the person reading it.

## WILL'S AUDIENCE
${COACHING_CLIENT_CONTEXT}

## NEWSLETTER FORMAT
- **Subject line**: Makes people open it. Short, specific, curiosity-driven. Under 50 characters. No clickbait, no ALL CAPS, no emojis.
- **Preview text**: One sentence that complements the subject. Under 90 characters.
- **Short intro hook**: 2-3 sentences max. No "Hope you're well." No "Happy Friday." Jump straight into the most interesting thing. Pull them in.
- **One core story/insight**: This is not a roundup newsletter. It is one thing Will wants to share this week. One coaching conversation, one pattern, one honest admission. Go deep on it.
- **The lesson or takeaway**: What does this mean for the reader? Make it practical without being preachy.
- **Sign-off**: Brief, warm. "Will" or similar. No CTA in the body.

## WRITING RULES
- Length: 400-700 words total. Respect their time.
- Never use em dashes. Replace with commas, periods, colons, or restructure.
- No corporate jargon. No AI hype. No guru language.
- Write how Will talks. Short sentences for impact. Longer ones to explain.
- The newsletter should feel like getting a sharp, honest email from a mate who coaches CEOs for a living.
- Ground everything in real coaching situations: "A founder I was speaking with this week..." or "This keeps coming up in conversations..."

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "subject": "Subject line",
  "preview_text": "Preview text",
  "body_markdown": "Full newsletter body in markdown (no CTA, just the story and sign-off)",
  "cta_text": "One warm paragraph leading to an action. Keep it specific, warm, no pressure. E.g. 'If any of this landed, reply and tell me what you are wrestling with right now. I read every reply.'"
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, topic, angle } = await request.json();
  if (!transcript || !transcript.trim()) {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const angleContext = angle
      ? `\nContent angle: "${angle.headline}"\nMood: ${angle.mood}\nPillar: ${angle.pillar}`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Turn this coaching content transcript into a newsletter email. Pick the single most compelling story or insight and go deep on it.${angleContext}${topic ? `\nTopic focus: ${topic}` : ''}\n\nTRANSCRIPT:\n${transcript.slice(0, 8000)}`,
      }],
    });

    const rawText = (message.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const newsletter = JSON.parse(rawText.slice(start, end + 1));

    return new Response(JSON.stringify({ success: true, newsletter }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Newsletter generation error:', err);
    return new Response(JSON.stringify({ error: 'Newsletter generation failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
