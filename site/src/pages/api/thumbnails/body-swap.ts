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

  const { base_image_url, lora_image_url, num_images = 4, custom_prompt } = await request.json();

  if (!base_image_url || !lora_image_url) {
    return new Response(JSON.stringify({ error: 'base_image_url and lora_image_url are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cost estimate: $0.15/image at 1K resolution
  const totalImages = Math.min(num_images, 4);
  const estimatedCost = totalImages * 0.15;

  const swapPrompt = custom_prompt ||
    'Replace the person in the first image with the person from the second image. ' +
    'Keep the exact same pose, position, clothing style, and scene composition. ' +
    'The result should look like a natural photo, not a composite. ' +
    'Maintain the original thumbnail style, lighting, and background. ' +
    'High quality, photorealistic result.';

  try {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
      input: {
        prompt: swapPrompt,
        image_urls: [base_image_url, lora_image_url],
        num_images: totalImages,
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
      model: 'nano-banana-pro-edit',
      step: 'body-swap',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Body swap error:', err);
    return new Response(JSON.stringify({
      error: 'Body swap failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
