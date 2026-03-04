import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

function getAnthropicApiKey(): string {
  return import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
}

async function fetchThumbnailBase64(videoId: string): Promise<{ data: string; media_type: string } | null> {
  // Try highest quality first, fall back to lower
  const qualities = ['sddefault', 'mqdefault', 'default'];
  for (const quality of qualities) {
    try {
      const url = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
      const res = await fetch(url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return { data: base64, media_type: 'image/jpeg' };
      }
    } catch {}
  }
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getAnthropicApiKey();
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { video_id, adapted_title, adapted_topic, original_title, outlier_score } = await request.json();

  if (!video_id) {
    return new Response(JSON.stringify({ error: 'video_id is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const thumbnail = await fetchThumbnailBase64(video_id);
    if (!thumbnail) {
      return new Response(JSON.stringify({ error: 'Could not fetch thumbnail image' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: thumbnail.media_type as any, data: thumbnail.data },
          },
          {
            type: 'text',
            text: `This YouTube thumbnail belongs to a video that got ${outlier_score || 'significantly'}x its channel's median views.

Original video: "${original_title || 'Unknown'}"
Will's adapted version: "${adapted_title || 'TBD'}" about ${adapted_topic || 'business growth'}

Analyze this thumbnail and generate a concept for Will's version.

Return valid JSON only (no markdown fences):
{
  "original_analysis": {
    "visual_elements": "What visual elements made this click-worthy",
    "text_overlay": "What text appears on the thumbnail and why it works",
    "composition": "How the elements are arranged (face placement, text placement, colors)",
    "emotion": "What emotion or reaction it triggers"
  },
  "concept": {
    "text_overlay": "2-4 words max for Will's thumbnail",
    "color_scheme": "Primary and accent colors to use",
    "composition": "What Will should do for the photo/layout",
    "key_elements": "Specific visual elements to include",
    "expression_direction": "What facial expression or pose Will should use"
  }
}`,
          },
        ],
      }],
    });

    const rawText = (message.content[0] as any).text || '';
    const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const conceptData = JSON.parse(cleaned);

    return new Response(JSON.stringify({
      success: true,
      video_id,
      thumbnail_url: `https://img.youtube.com/vi/${video_id}/mqdefault.jpg`,
      ...conceptData,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Thumbnail concept error:', err);
    return new Response(JSON.stringify({ error: 'Thumbnail concept generation failed', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
