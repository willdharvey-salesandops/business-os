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

  const { audio_url } = await request.json();
  if (!audio_url) {
    return new Response(JSON.stringify({ error: 'audio_url is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await fal.subscribe('fal-ai/whisper', {
      input: {
        audio_url,
        task: 'transcribe',
        language: 'en',
        chunk_level: 'segment',
      },
    });

    const data = result.data as any;

    return new Response(JSON.stringify({
      success: true,
      text: data?.text || '',
      chunks: data?.chunks || [],
      duration_seconds: Math.round(data?.chunks?.reduce((max: number, c: any) =>
        Math.max(max, c?.timestamp?.[1] || 0), 0) || 0),
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Transcription error:', err);
    return new Response(JSON.stringify({ error: 'Transcription failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
