import type { APIRoute } from 'astro';

export const prerender = false;

function getFalKey(): string {
  // Try multiple env var patterns - Vercel exposes them via process.env at runtime
  return import.meta.env.FAL_KEY
    || process.env.FAL_KEY
    || import.meta.env.FAL_AI_KEY
    || process.env.FAL_AI_KEY
    || '';
}

export const POST: APIRoute = async () => {
  const falKey = getFalKey();

  if (!falKey) {
    // Log available env var keys (redacted) to help debug
    const envKeys = Object.keys(process.env).filter(k =>
      k.includes('FAL') || k.includes('fal')
    );
    console.error('FAL_KEY not found. FAL-related env vars:', envKeys);

    return new Response(JSON.stringify({
      error: 'FAL_KEY not configured',
      debug: 'Found env vars containing FAL: ' + envKeys.join(', '),
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, fal_key: falKey }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
