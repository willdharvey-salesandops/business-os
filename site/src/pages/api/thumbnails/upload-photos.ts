import type { APIRoute } from 'astro';
import { fal } from '@fal-ai/client';

export const prerender = false;

function getFalKey(): string {
  return import.meta.env.FAL_KEY || process.env.FAL_KEY || '';
}

export const POST: APIRoute = async ({ request }) => {
  const falKey = getFalKey();
  if (!falKey) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  fal.config({ credentials: falKey });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upload to fal.ai storage
    const url = await fal.storage.upload(file);

    return new Response(JSON.stringify({
      success: true,
      url,
      filename: file.name,
      size: file.size,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({
      error: 'File upload failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
