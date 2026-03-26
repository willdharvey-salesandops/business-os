import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { COACHING_VOICE_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a social media content adapter for Will Harvey, a leadership coach who works with CEOs, founders, and business owners.

## WILL'S VOICE
${COACHING_VOICE_CONTEXT}

## YOUR TASK
Take the source content (transcript from a coaching-focused video) and create platform-specific distribution snippets. Each must feel native to its platform.

## PLATFORM RULES

### LinkedIn Post
- 150-300 words
- Open with a hook line that stops the scroll. Coaching insight, bold statement, or honest admission.
- Use line breaks liberally (LinkedIn rewards white space)
- Include a question at the end to drive comments
- No hashtags in the body, 3-5 hashtags at the very end
- Professional but human. This is a coach sharing real work, not a thought leader performing.

### Twitter/X Thread
- 3-5 tweets, each under 280 characters
- Tweet 1 is the hook (must stand alone)
- Last tweet has the CTA
- Number the tweets (1/, 2/, etc.)
- No hashtags except optionally on the last tweet
- Direct, punchy, no fluff

### YouTube Description
- First 2 lines are the most important (shown before "Show more")
- Include timestamps if content sections are clear
- End with links section and brief bio
- 150-300 words total

### Instagram Caption
- 100-200 words
- More personal and vulnerable than LinkedIn
- End with a CTA question that invites real replies
- Include 5-10 hashtags at the end (separated by a line break)
- Coaching, leadership, and personal growth hashtags, not AI/tech ones

Never use em dashes in any output. Replace with commas, periods, colons, or restructure.

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "linkedin_post": "Full LinkedIn post text",
  "twitter_thread": ["Tweet 1/", "Tweet 2/", "Tweet 3/"],
  "youtube_description": "Full YouTube description",
  "instagram_caption": "Full Instagram caption"
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, blog_title, blog_excerpt, newsletter_subject } = await request.json();
  if (!transcript) {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Create distribution snippets for all platforms from this coaching content.\n\n${blog_title ? `Blog title: "${blog_title}"` : ''}${blog_excerpt ? `\nBlog excerpt: "${blog_excerpt}"` : ''}${newsletter_subject ? `\nNewsletter subject: "${newsletter_subject}"` : ''}\n\nSOURCE TRANSCRIPT:\n${transcript.slice(0, 6000)}`,
      }],
    });

    const rawText = (message.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const snippets = JSON.parse(rawText.slice(start, end + 1));

    return new Response(JSON.stringify({ success: true, snippets }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Distribution generation error:', err);
    return new Response(JSON.stringify({ error: 'Distribution generation failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
