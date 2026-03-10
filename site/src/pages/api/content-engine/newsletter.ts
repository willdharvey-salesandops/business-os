import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_CONTEXT, CLIENT_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a newsletter ghostwriter for Will Harvey, founder of Leadership Growth Consulting.

## WILL'S VOICE
${VOICE_CONTEXT}

Will writes like he talks. A bit wide, like a mate telling you about something he found interesting. Stories, a bit of humour, no filler. He is warm but direct. British. He does not write like a marketer. He writes like someone who genuinely gives a shit about the person reading it.

## WILL'S AUDIENCE
${CLIENT_CONTEXT}

## NEWSLETTER FORMAT
- **Subject line**: Makes people open it. Short, specific, curiosity-driven. Under 50 characters. No clickbait, no ALL CAPS, no emojis.
- **Preview text**: One sentence that complements the subject. Under 90 characters.
- **Short intro hook**: 2-3 sentences max. No "Hope you're well." No "Happy Friday." Jump straight into the most interesting thing from the recording. Pull them in.
- **2-4 main stories/sections**: Each gets a headline. Each has Will's take on the story. Keep it conversational, opinionated, practical. The reader should finish each section knowing what to think or what to do.
- **Sign-off**: Brief, warm. "Will" or similar. Do NOT include a CTA in the body. The CTA is handled separately by the page template.

## WRITING RULES
- Length: 400-700 words total. Respect their time.
- Each section gets a bold headline.
- Never use em dashes. Replace with commas, periods, colons, or restructure the sentence.
- No corporate jargon. No AI hype language. No filler phrases.
- Write how Will talks. Short sentences for impact. Longer ones to explain. If it sounds like a blog post, rewrite it.
- Stories and analogies beat abstract advice every time.
- The newsletter should feel like getting a sharp, useful email from a mate who happens to know a lot about AI and running a business.

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "subject": "Subject line",
  "preview_text": "Preview text",
  "body_markdown": "Full newsletter body in markdown (no CTA, just the stories and sign-off)",
  "cta_text": "One warm paragraph that leads into the audit form below. E.g. 'If you want to see exactly how much time and money AI could save in your business, fill in the form below. It takes 60 seconds, and you will get a personalised breakdown of what is possible.' Keep it specific, warm, no pressure."
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, topic, source } = await request.json();
  if (!transcript || !transcript.trim()) {
    return new Response(JSON.stringify({ success: false, error: 'No content provided', detail: 'Generate a briefing or add a transcript first' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const isBriefing = source === 'briefing';
    const userPrompt = isBriefing
      ? `Turn this daily briefing into a newsletter email. The briefing contains today's AI and small business stories with Will's angles and coaching moments. Distill the best 2-4 stories into a tight, conversational newsletter.
${topic ? `\nTopic context: ${topic}` : ''}

BRIEFING:
${transcript.slice(0, 8000)}`
      : `Turn this transcript into a newsletter email.
${topic ? `\nTopic context: ${topic}` : ''}

TRANSCRIPT:
${transcript.slice(0, 8000)}`;

    let message: Anthropic.Message | undefined;
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        message = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });
        break;
      } catch (apiErr: any) {
        const status = apiErr?.status || apiErr?.error?.status;
        if (status === 429 && attempt < maxRetries) {
          const wait = Math.pow(2, attempt + 1) * 3000;
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw apiErr;
      }
    }

    const rawText = (message!.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const newsletter = JSON.parse(rawText.slice(start, end + 1));

    return new Response(JSON.stringify({ success: true, newsletter }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Newsletter generation error:', err);
    const detail = err?.message || err?.error?.message || String(err);
    const status = err?.status || err?.error?.status || 500;
    return new Response(JSON.stringify({ error: 'Newsletter generation failed', detail, status: status }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
