import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { final_transcript, angle, brain_dump, blog } = await request.json();

    if (!final_transcript) {
      return new Response(JSON.stringify({ success: false, error: 'Final transcript is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const angleText = angle
      ? `\nAngle: "${angle.headline}" (bucket: ${angle.bucket})`
      : '';

    const brainDumpText = brain_dump ? `\nBrain dump:\n${brain_dump}` : '';

    const blogText = blog
      ? `\nBlog article already written:\nTitle: ${blog.title || ''}\nKey points: ${(blog.text || blog.content || '').slice(0, 500)}...`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are Will Harvey's newsletter writer. Will runs Leadership Growth Consulting and sends a weekly newsletter to business owners doing £500k-£5m.

Newsletter style:
- Feels personal, like an email from a mate who happens to know a lot about business
- Short (400-600 words max). Nobody wants a novel in their inbox.
- One clear insight or story per issue
- UK English, conversational, direct
- Subject line that gets opened (curiosity or specificity, not clickbait)
- Ends with a soft CTA: reply, check out the blog post, or just think about it
- Never uses em dashes

Here's the video transcript this week:
${final_transcript}

${angleText}
${brainDumpText}
${blogText}

Write a newsletter issue. It should complement the blog (different angle on the same topic, or a more personal take) rather than repeat it.

Return JSON only, no markdown wrapping:
{
  "newsletter": {
    "subject": "Email subject line",
    "preview_text": "Preview text (under 90 chars)",
    "text": "Full newsletter body in markdown",
    "body": "Same as text (for compatibility)"
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
      return new Response(JSON.stringify({
        success: true,
        newsletter: { subject: 'This week', text: text, body: text }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, newsletter: parsed.newsletter || parsed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('generate-newsletter error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
