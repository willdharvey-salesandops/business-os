import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () => {
  const falKey = import.meta.env.FAL_KEY || process.env.FAL_KEY || '';

  if (!falKey) {
    return new Response(JSON.stringify({ error: 'FAL_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, fal_key: falKey }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
