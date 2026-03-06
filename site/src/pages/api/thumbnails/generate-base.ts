import type { APIRoute } from 'astro';
import { fal } from '@fal-ai/client';

export const prerender = false;

function getFalKey(): string {
  const k = 'FAL_KEY'; return import.meta.env.FAL_KEY || process.env[k] || '';
}

export const POST: APIRoute = async ({ request }) => {
  const falKey = getFalKey();
  if (!falKey) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  fal.config({ credentials: falKey });

  const { prompt, num_images = 4, aspect_ratio = '16:9' } = await request.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: 'prompt is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cost estimate: $0.15/image at 1K resolution
  const estimatedCost = num_images * 0.15;

  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro', {
      input: {
        prompt,
        num_images: Math.min(num_images, 4),
        aspect_ratio,
        resolution: '1K',
        output_format: 'png',
        safety_tolerance: 4,
      },
    });

    const images = (result.data as any)?.images || [];

    return new Response(JSON.stringify({
      success: true,
      images: images.map((img: any) => ({
        url: img.url,
        width: img.width,
        height: img.height,
      })),
      estimated_cost: `$${estimatedCost.toFixed(2)}`,
      model: 'nano-banana-pro',
      step: 'base-generation',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Generate base thumbnail error:', err);
    return new Response(JSON.stringify({
      error: 'Base thumbnail generation failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
