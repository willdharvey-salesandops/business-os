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

  const { image_url } = await request.json();

  if (!image_url) {
    return new Response(JSON.stringify({ error: 'image_url is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await fal.subscribe('fal-ai/birefnet', {
      input: {
        image_url,
        model: 'General Use (Light)',
        output_format: 'png',
      },
    });

    const image = (result.data as any)?.image;
    if (!image?.url) throw new Error('No cutout image returned');

    return new Response(JSON.stringify({
      success: true,
      cutout_url: image.url,
      width: image.width,
      height: image.height,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Background removal error:', err);
    return new Response(JSON.stringify({
      error: 'Background removal failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
