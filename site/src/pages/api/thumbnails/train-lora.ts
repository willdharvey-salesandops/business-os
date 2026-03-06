import type { APIRoute } from 'astro';
import { fal } from '@fal-ai/client';

export const prerender = false;

function getFalKey(): string {
  const k = 'FAL_KEY'; return import.meta.env.FAL_KEY || process.env[k] || '';
}

function getSupabaseConfig() {
  const url = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, key };
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

  // Cost estimate: ~$2.40 for 1000 steps
  const estimatedCost = (steps / 1000) * 2.40;

  try {
    const result = await fal.subscribe('fal-ai/flux-lora-fast-training', {
      input: {
        images_data_url: images_zip_url,
        trigger_word,
        steps: Math.min(steps, 5000),
        create_masks: true,
      },
    });

    const data = result.data as any;
    const weightsUrl = data?.diffusers_lora_file?.url || '';
    const configUrl = data?.config_file?.url || '';

    // Save to Supabase if configured
    const sb = getSupabaseConfig();
    if (sb.url && sb.key && weightsUrl) {
      try {
        await fetch(`${sb.url}/rest/v1/lora_models`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': sb.key,
            'Authorization': `Bearer ${sb.key}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            weights_url: weightsUrl,
            trigger_word,
            training_steps: steps,
          }),
        });
      } catch (dbErr) {
        console.error('Failed to save LoRA to Supabase:', dbErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      weights_url: weightsUrl,
      config_url: configUrl,
      trigger_word,
      steps,
      estimated_cost: `$${estimatedCost.toFixed(2)}`,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('LoRA training error:', err);
    return new Response(JSON.stringify({
      error: 'LoRA training failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
