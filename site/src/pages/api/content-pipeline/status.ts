import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * GET /api/content-pipeline/status
 * Returns pipeline status: today's items and recent history
 *
 * GET /api/content-pipeline/status?days=7 for last 7 days
 */
export const GET: APIRoute = async ({ url }) => {
  const supabase = getSupabase();
  const days = parseInt(url.searchParams.get('days') || '1');
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: items, error } = await supabase
    .from('content_pipeline')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const summary = {
    total: items?.length || 0,
    by_status: {} as Record<string, number>,
    by_type: {} as Record<string, number>,
  };

  for (const item of items || []) {
    summary.by_status[item.status] = (summary.by_status[item.status] || 0) + 1;
    summary.by_type[item.content_type] = (summary.by_type[item.content_type] || 0) + 1;
  }

  return new Response(JSON.stringify({ summary, items }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
