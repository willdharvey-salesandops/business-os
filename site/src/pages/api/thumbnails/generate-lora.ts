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

// Expression prompt templates for natural-looking poses
const EXPRESSION_PROMPTS: Record<string, string> = {
  excited: 'looking excited and energetic, bright smile, eyes wide, dynamic pose',
  confident: 'standing confidently, slight smile, arms crossed or hands on hips, professional look',
  thinking: 'hand on chin, thoughtful expression, looking slightly upward, contemplative',
  pointing: 'pointing toward camera or to the side, engaging expression, direct eye contact',
  surprised: 'eyes slightly wide, mouth slightly open, genuine surprise, natural pose',
  professional: 'professional headshot style, composed expression, business casual, clean background',
};

export const POST: APIRoute = async ({ request }) => {
  const falKey = getFalKey();
  if (!falKey) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  fal.config({ credentials: falKey });

  const { expressions = ['confident'], lora_url, trigger_word = 'WILLH', num_images = 4 } = await request.json();

  // If no lora_url provided, try to fetch the latest from Supabase
  let weightsUrl = lora_url;
  if (!weightsUrl) {
    const sb = getSupabaseConfig();
    if (sb.url && sb.key) {
      try {
        const res = await fetch(
          `${sb.url}/rest/v1/lora_models?order=created_at.desc&limit=1`,
          {
            headers: {
              'apikey': sb.key,
              'Authorization': `Bearer ${sb.key}`,
            },
          }
        );
        const models = await res.json();
        if (models?.[0]?.weights_url) {
          weightsUrl = models[0].weights_url;
        }
      } catch {}
    }
  }

  if (!weightsUrl) {
    return new Response(JSON.stringify({ error: 'No LoRA model found. Train one first or provide lora_url.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build prompts from expressions
  const expressionList = Array.isArray(expressions) ? expressions : [expressions];
  const prompts = expressionList.map(
    (expr: string) => EXPRESSION_PROMPTS[expr] || expr
  );

  // Cost estimate: ~$0.021/megapixel, roughly $0.03/image at 1024x1024
  const totalImages = Math.min(num_images, 4);
  const estimatedCost = totalImages * 0.03;

  try {
    // Generate one batch with the first expression as the main prompt
    const mainPrompt = `${trigger_word} person, ${prompts.join(', ')}, clean background, studio lighting, high quality photo, no exaggerated facial expressions`;

    const result = await fal.subscribe('fal-ai/flux-2/lora', {
      input: {
        prompt: mainPrompt,
        num_images: totalImages,
        image_size: 'square_hd',
        guidance_scale: 2.5,
        num_inference_steps: 28,
        output_format: 'png',
        enable_safety_checker: true,
        loras: [{ path: weightsUrl, scale: 1.0 }],
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
      expressions: expressionList,
      estimated_cost: `$${estimatedCost.toFixed(2)}`,
      model: 'flux-2-lora',
      step: 'lora-generation',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('LoRA generation error:', err);
    return new Response(JSON.stringify({
      error: 'LoRA photo generation failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
