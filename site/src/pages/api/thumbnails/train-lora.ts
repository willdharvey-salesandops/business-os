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

  const { images_zip_url, trigger_word = 'WILLH', steps = 1000 } = await request.json();

  if (!images_zip_url) {
    return new Response(JSON.stringify({ error: 'images_zip_url is required (URL to a ZIP of training photos)' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const estimatedCost = (steps / 1000) * 2.40;

  try {
    // Submit to queue (returns immediately with request_id)
    const { request_id } = await fal.queue.submit('fal-ai/flux-lora-fast-training', {
      input: {
        images_data_url: images_zip_url,
        trigger_word,
        steps: Math.min(steps, 5000),
        create_masks: true,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      request_id,
      trigger_word,
      steps,
      estimated_cost: `$${estimatedCost.toFixed(2)}`,
      message: 'Training submitted. Poll /api/thumbnails/train-status for progress.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('LoRA training submit error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to submit LoRA training',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
