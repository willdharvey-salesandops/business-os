import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const POST: APIRoute = async ({ request }) => {
  try {
    const { rough_transcript, angle, brain_dump, themes } = await request.json();

    if (!rough_transcript) {
      return new Response(JSON.stringify({ success: false, error: 'Rough transcript is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const angleText = angle
      ? `Selected angle: "${angle.headline}" (bucket: ${angle.bucket})${angle.description ? `\nDescription: ${angle.description}` : ''}${angle.crossover ? `\nCrossover: ${angle.crossover}` : ''}`
      : '';

    const brainDumpText = brain_dump ? `\nBrain dump context:\n${brain_dump}` : '';

    const themesText = themes && themes.length
      ? `\nExtracted themes:\n${themes.map((t: any) => `- ${t.theme} (${t.pillar}): ${t.context}`).join('\n')}`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are a scriptwriter for Will Harvey's YouTube and LinkedIn video content. Will runs Leadership Growth Consulting and works with business owners doing £500k-£5m who are stuck being the bottleneck. He also builds Email Shepherd, a SaaS email platform.

Will's voice: Direct, conversational, no jargon. Short sentences. UK English. Warm but not soft. He talks like he's having a coffee with someone, not presenting. He never says "leverage synergies" or any consultant speak. He says things like "the business works, but it's costing you more than it should."

Here's Will's rough run-through (him talking through the topic informally):
${rough_transcript}

${angleText}
${brainDumpText}
${themesText}

Create a structured 8-10 minute video script. The script should:
- Keep Will's natural speaking style, just tighten and structure it
- Open with a hook that stops the scroll (first 5 seconds matter)
- Have clear sections that flow naturally
- Include specific stories or examples from the rough transcript
- End with something that makes people think, not a hard CTA
- If Email Shepherd fits naturally, weave it in. If not, don't force it.
- Target duration: 8-10 minutes when spoken at natural pace (~1,500-1,800 words)

Return JSON only, no markdown wrapping:
{
  "script": {
    "title": "Video title (YouTube-friendly, under 60 chars)",
    "duration": "~8-10 minutes",
    "sections": [
      {
        "label": "Hook (0:00-0:30)",
        "text": "..."
      },
      {
        "label": "Setup (0:30-2:00)",
        "text": "..."
      },
      {
        "label": "Close",
        "text": "..."
      }
    ],
    "text": "Full script as continuous text for teleprompter use"
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
        script: {
          title: angle?.headline || 'Video Script',
          duration: '~8-10 minutes',
          text: text,
          sections: [{ label: 'Full Script', text: text }]
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, script: parsed.script || parsed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('create-script error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
