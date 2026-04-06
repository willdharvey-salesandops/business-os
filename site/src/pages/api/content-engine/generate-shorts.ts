import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { final_transcript, angle, count = 5 } = await request.json();

    if (!final_transcript) {
      return new Response(JSON.stringify({ success: false, error: 'Final transcript is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const angleText = angle
      ? `\nSelected angle: "${angle.headline}" (bucket: ${angle.bucket})`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are a short-form video editor identifying the best clips from Will Harvey's long-form video transcript.

Will runs Leadership Growth Consulting and works with business owners doing £500k-£5m. He also builds Email Shepherd (SaaS email platform). His style is direct, conversational, UK English.

Here's the full transcript from his recorded video:
${final_transcript}

${angleText}

Identify the ${count} best moments in this transcript that would work as standalone short-form clips (LinkedIn video, YouTube Shorts, Reels). Each clip should:
- Be 30-60 seconds when spoken naturally (~75-150 words)
- Have a strong hook in the first line that works without context
- Tell a complete mini-story or make a complete point
- Work as a standalone piece (someone seeing it cold should get value)
- Feel punchy and quotable

Return JSON only, no markdown wrapping:
{
  "scripts": [
    {
      "hook": "The opening line / hook",
      "title": "Short descriptive title",
      "text": "The full clip script text",
      "duration": "~30-45s",
      "timestamp_hint": "Approximate location in original (e.g. 'around 3:00-4:00')"
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
      return new Response(JSON.stringify({ success: false, error: 'Failed to parse short scripts' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, scripts: parsed.scripts || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('generate-shorts error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
