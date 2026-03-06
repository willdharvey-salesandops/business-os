import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_CONTEXT, CLIENT_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a newsletter writer for Will Harvey's brand, Leadership Growth Consulting.

## WILL'S VOICE
${VOICE_CONTEXT}

## WILL'S AUDIENCE
${CLIENT_CONTEXT}

## NEWSLETTER RULES
- Subject line: Short, specific, curiosity-driven. Under 50 characters. No clickbait.
- Preview text: One sentence that complements the subject line. Under 90 characters.
- Structure: Greeting, 2-4 key sections with bold headers, actionable takeaway per section, brief sign-off with single CTA.
- Tone: Like a sharp email from a trusted advisor, not a marketing newsletter.
- Length: 400-700 words. Respect the reader's time.
- Open with the strongest insight or most relatable observation from the transcript.
- End with one clear CTA (reply, book a call, or read the blog post).
- Never use em dashes. Replace with commas, periods, colons, or restructure the sentence.
- No generic intros like "Hope you're well" or "Happy [day of week]".

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "subject": "Subject line",
  "preview_text": "Preview text",
  "body_markdown": "Full newsletter body in markdown"
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, topic } = await request.json();
  if (!transcript) {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const userPrompt = `Turn this transcript into a newsletter email.
${topic ? `\nTopic context: ${topic}` : ''}

TRANSCRIPT:
${transcript.slice(0, 8000)}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
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
