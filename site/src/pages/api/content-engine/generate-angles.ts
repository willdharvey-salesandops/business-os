import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { themes, brain_dump, briefing, extra_context, source_type } = await request.json();

    if (!themes || !themes.length) {
      return new Response(JSON.stringify({ success: false, error: 'Themes are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const themesText = themes.map((t: any) =>
      `- ${t.theme} (pillar: ${t.pillar || 'general'}, type: ${t.type || 'unknown'}): ${t.context || ''}`
    ).join('\n');

    const briefingText = briefing
      ? `\n\nToday's news briefing:\n${JSON.stringify(briefing, null, 2)}`
      : '';

    const brainDumpText = brain_dump
      ? `\n\nBrain dump (what's on Will's mind today):\n${brain_dump}`
      : '';

    const extraText = extra_context
      ? `\n\nAdditional context:\n${extra_context}`
      : '';

    const sourceLabel: Record<string, string> = {
      coaching: 'a coaching session',
      business_meeting: 'a business meeting',
      sales_call: 'a sales call',
      industry: 'an industry conversation',
      walk_talk: 'a walk-and-talk / voice note',
      other: 'a conversation'
    };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a content strategist for Will Harvey, who runs Leadership Growth Consulting. He works with business owners (£500k-£5m revenue) who are stuck being the person everything depends on. He also builds Email Shepherd, a SaaS email platform.

Will's content sits in three buckets:
1. **Leadership & People** — What he sees working with business owners. Delegation, team building, getting out of the weeds. Real stories from real sessions.
2. **Systems & Automation** — How to build systems so the business doesn't depend on the owner. This is where Email Shepherd lives naturally. Not pushing the product, just showing the thinking.
3. **Founder Journey** — Behind the scenes of building something. Honest, no-filter takes on growing a business and a SaaS product at the same time.

These themes were extracted from ${sourceLabel[source_type] || 'a conversation'}:
${themesText}
${brainDumpText}
${briefingText}
${extraText}

Generate 4-6 content angles for LinkedIn posts. Each angle should:
- Be tagged with one primary bucket (leadership, systems, or founder)
- Have a punchy headline (the kind that stops someone scrolling)
- Have a short description of the angle and what makes it interesting
- Include a "crossover" note if the angle naturally bridges two buckets (e.g. a leadership insight that leads into why automation matters)
- Sound like Will: direct, conversational, no jargon. UK English.

Return JSON only, no markdown wrapping:
{
  "angles": [
    {
      "bucket": "leadership" | "systems" | "founder",
      "headline": "...",
      "description": "...",
      "crossover": "..." or null
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
      return new Response(JSON.stringify({ success: false, error: 'Failed to parse angles response' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, angles: parsed.angles || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('generate-angles error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
