import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { final_transcript, angle, brain_dump } = await request.json();

    if (!final_transcript) {
      return new Response(JSON.stringify({ success: false, error: 'Final transcript is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const angleText = angle
      ? `\nAngle: "${angle.headline}" (bucket: ${angle.bucket})\n${angle.description || ''}`
      : '';

    const brainDumpText = brain_dump ? `\nContext from brain dump:\n${brain_dump}` : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are Will Harvey's blog writer. Will runs Leadership Growth Consulting and works with business owners doing £500k-£5m.

Will's writing voice: Direct, conversational, UK English. Short paragraphs. No corporate fluff. Reads like someone smart explaining something over coffee, not a thought piece. Never uses em dashes. Says "systems" not "solutions". Says "build" not "implement".

Here's the recorded transcript:
${final_transcript}

${angleText}
${brainDumpText}

Write a blog article (800-1,200 words) that:
- Has a compelling title (SEO-friendly but not clickbait)
- Opens with a story or specific situation, not a thesis statement
- Makes one clear point well, rather than covering everything
- Includes practical takeaways without being a listicle
- Ends with something that resonates, not a hard sell
- If Email Shepherd fits naturally, mention it. If not, don't.
- Has a meta description (under 160 chars) for SEO

Return JSON only, no markdown wrapping:
{
  "blog": {
    "title": "...",
    "meta_description": "...",
    "text": "Full blog article in markdown format",
    "content": "Same as text (for compatibility)"
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
        blog: { title: angle?.headline || 'Blog Article', text: text, content: text }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, blog: parsed.blog || parsed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('generate-blog error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
