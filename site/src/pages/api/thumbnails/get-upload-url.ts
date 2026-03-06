import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  // Debug: check all env var access methods (rebuild after adding FAL_KEY)
  const fromImportMeta = import.meta.env.FAL_KEY || '';
  const k = 'FAL_KEY';
  const fromProcessEnv = process.env[k] || '';
  const falKey = fromImportMeta || fromProcessEnv;

  // Return debug info (mask the actual key value)
  const envKeys = Object.keys(process.env).filter(key => key.includes('FAL') || key.includes('SUPABASE') || key.includes('ANTHROPIC'));

  if (!falKey) {
    return new Response(JSON.stringify({
      error: 'FAL_KEY not configured',
      debug: {
        fromImportMeta: fromImportMeta ? 'SET' : 'EMPTY',
        fromProcessEnv: fromProcessEnv ? 'SET' : 'EMPTY',
        relevantEnvKeys: envKeys,
        totalEnvKeys: Object.keys(process.env).length,
      },
    }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, fal_key: falKey }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
