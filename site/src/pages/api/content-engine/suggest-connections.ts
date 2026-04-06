import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { niche, angle, linkedin_post } = await request.json();

    if (!niche) {
      return new Response(JSON.stringify({ success: false, error: 'Niche is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const angleText = angle
      ? `\nThis week's content angle: "${angle.headline}" (${angle.bucket})\n${angle.description || ''}`
      : '';

    const postText = linkedin_post
      ? `\nThis week's LinkedIn post hook: "${typeof linkedin_post === 'string' ? linkedin_post.slice(0, 200) : (linkedin_post.hook || linkedin_post.text?.slice(0, 200) || '')}"`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are Will Harvey's LinkedIn outreach strategist. Will runs Leadership Growth Consulting and works with business owners doing £500k-£5m who are stuck being the bottleneck. He also builds Email Shepherd (SaaS email platform).

Will wants to connect with 10 new people in this niche each week: ${niche}

${angleText}
${postText}

Suggest 10 types of people Will should connect with on LinkedIn this week. For each, provide:
- A realistic name and role (make these feel real, not generic)
- Why this person would be a good connection
- A short, natural connection message (under 300 chars for LinkedIn limit)

The connection messages should:
- Sound like Will: direct, warm, no fluff
- Reference something specific (the niche, a shared interest, the content topic)
- Never be salesy or pitchy
- Feel like a real person reaching out, not a template
- UK English

Return JSON only, no markdown wrapping:
{
  "suggestions": [
    {
      "name": "Realistic name",
      "role": "Their title / company type",
      "note": "Why this connection makes sense",
      "action": "Connect + comment on their recent post",
      "message": "The connection request message (under 300 chars)"
    }
  ]
}`
      }]
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Failed to parse connection suggestions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, suggestions: parsed.suggestions || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('suggest-connections error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
