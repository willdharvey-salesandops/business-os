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
      ? `\nSelected angle: "${angle.headline}" (bucket: ${angle.bucket})\n${angle.description || ''}`
      : '';

    const brainDumpText = brain_dump ? `\nBrain dump:\n${brain_dump}` : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `You are Will Harvey's LinkedIn ghostwriter. Will runs Leadership Growth Consulting and works with business owners doing £500k-£5m who are stuck being the bottleneck in their own business.

Will's LinkedIn voice:
- Direct, punchy opening line. No "I've been thinking about..." or "Here's the thing about..."
- Short paragraphs (1-2 sentences max)
- Real stories and specific details, not generic advice
- UK English throughout
- Feels like a mate telling you what happened, not a thought leader performing
- Never uses hashtags in the body. Maybe 2-3 relevant ones at the very end.
- No emojis except occasionally a single one
- Ends with something that makes people reflect or respond, not "Follow me for more"
- 150-250 words. Tight. Every word earns its place.
- Never uses em dashes.

Here's the recorded final transcript:
${final_transcript}

${angleText}
${brainDumpText}

Write one LinkedIn post. Return JSON only, no markdown wrapping:
{
  "post": {
    "text": "The full post text ready to copy-paste into LinkedIn",
    "hook": "The opening line (for preview)"
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
        post: { text: text, hook: text.split('\n')[0] }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, post: parsed.post || parsed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('generate-linkedin error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
