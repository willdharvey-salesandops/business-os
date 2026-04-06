import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { linkedin_post, blog, newsletter, angle } = await request.json();

    const postText = linkedin_post
      ? `LinkedIn post:\n${typeof linkedin_post === 'string' ? linkedin_post : linkedin_post.text || ''}`
      : '';

    const blogText = blog
      ? `\nBlog title: ${blog.title || ''}\nBlog excerpt: ${(blog.text || blog.content || '').slice(0, 300)}...`
      : '';

    const newsletterText = newsletter
      ? `\nNewsletter subject: ${newsletter.subject || ''}\nNewsletter excerpt: ${(newsletter.text || newsletter.body || '').slice(0, 300)}...`
      : '';

    const angleText = angle
      ? `\nContent angle: "${angle.headline}" (${angle.bucket})`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are Will Harvey's social media manager. Will runs Leadership Growth Consulting and Email Shepherd. He's direct, conversational, UK English.

This week's content:
${postText}
${blogText}
${newsletterText}
${angleText}

Create distribution snippets for each platform. Each should feel native to the platform, not a copy-paste of the LinkedIn post.

Return JSON only, no markdown wrapping:
{
  "snippets": {
    "twitter_thread": "A 3-5 tweet thread (separate tweets with \\n\\n---\\n\\n). First tweet is the hook. Last tweet links back to the blog/video.",
    "youtube_description": "YouTube video description with timestamps placeholder, key points, and links.",
    "instagram_caption": "Instagram caption (more visual/story-driven). Include relevant hashtags at the end."
  }
}`
      }]
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Failed to parse distribution snippets' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, snippets: parsed.snippets || parsed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('generate-distribution error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
