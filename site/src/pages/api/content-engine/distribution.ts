import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a social media content adapter for Will Harvey's brand, Leadership Growth Consulting.

## WILL'S VOICE
${VOICE_CONTEXT}

## YOUR TASK
Take the source content (transcript, newsletter, blog) and create platform-specific distribution snippets. Each snippet must feel native to its platform, not like a cross-posted afterthought.

## PLATFORM RULES

### LinkedIn Post
- 150-300 words
- Open with a hook line (standalone sentence that stops the scroll)
- Use line breaks liberally (LinkedIn rewards white space)
- Include a question at the end to drive comments
- No hashtags in the body, 3-5 hashtags at the very end
- Professional but human tone

### Twitter/X Thread
- 3-5 tweets, each under 280 characters
- Tweet 1 is the hook (must stand alone and make people want to read more)
- Last tweet has the CTA
- Number the tweets (1/, 2/, etc.)
- No hashtags except optionally on the last tweet

### YouTube Description
- First 2 lines are the most important (shown before "Show more")
- Include timestamps if content sections are clear
- End with links section and brief bio
- 150-300 words total

### Instagram Caption
- 100-200 words
- Conversational, slightly more casual than LinkedIn
- End with a CTA question
- Include 5-10 hashtags at the end (separated by a line break)

Never use em dashes in any output. Replace with commas, periods, colons, or restructure the sentence.

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

  const { transcript, newsletter_subject, blog_title, blog_excerpt } = await request.json();
  if (!transcript) {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const userPrompt = `Create distribution snippets for all platforms from this source content.

${blog_title ? `Blog title: "${blog_title}"` : ''}
${blog_excerpt ? `Blog excerpt: "${blog_excerpt}"` : ''}
${newsletter_subject ? `Newsletter subject: "${newsletter_subject}"` : ''}

SOURCE TRANSCRIPT:
${transcript.slice(0, 6000)}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
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
