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

  const { request_id, trigger_word = 'WILLH', steps = 1000 } = await request.json();

  if (!request_id) {
    return new Response(JSON.stringify({ error: 'request_id is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check queue status
    const status = await fal.queue.status('fal-ai/flux-lora-fast-training', {
      requestId: request_id,
      logs: true,
    });

    // If still processing, return status
    if (status.status !== 'COMPLETED') {
      return new Response(JSON.stringify({
        status: status.status,
        request_id,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Completed: fetch the result
    const result = await fal.queue.result('fal-ai/flux-lora-fast-training', {
      requestId: request_id,
    });

    // Try multiple paths for the weights URL since the structure may vary
    const data = result.data as any;
    const weightsUrl = data?.diffusers_lora_file?.url
      || data?.diffusers_lora_file
      || (result as any)?.diffusers_lora_file?.url
      || (result as any)?.diffusers_lora_file
      || '';
    const configUrl = data?.config_file?.url
      || data?.config_file
      || (result as any)?.config_file?.url
      || '';

    // Save to Supabase if configured
    const sb = getSupabaseConfig();
    let dbSaved = false;
    if (sb.url && sb.key && weightsUrl) {
      try {
        const dbRes = await fetch(`${sb.url}/rest/v1/lora_models`, {
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
        dbSaved = dbRes.ok;
        if (!dbRes.ok) {
          console.error('Supabase save failed:', dbRes.status, await dbRes.text());
        }
      } catch (dbErr) {
        console.error('Failed to save LoRA to Supabase:', dbErr);
      }
    }

    return new Response(JSON.stringify({
      status: 'COMPLETED',
      success: true,
      weights_url: weightsUrl,
      config_url: configUrl,
      trigger_word,
      steps,
      db_saved: dbSaved,
      debug_keys: weightsUrl ? undefined : Object.keys(data || {}),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('LoRA status check error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to check training status',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
