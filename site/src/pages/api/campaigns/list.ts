import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

export const GET: APIRoute = async ({ url }) => {
  const supabase = getSupabase();
  const batchId = url.searchParams.get('batch_id');

  if (batchId) {
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Count by status
    const counts: Record<string, number> = {};
    for (const p of prospects || []) {
      counts[p.pipeline_status] = (counts[p.pipeline_status] || 0) + 1;
    }

    return new Response(JSON.stringify({ prospects, counts }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // List all batches
  const { data: batches, error } = await supabase
    .from('campaign_batches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get status counts per batch
  for (const batch of batches || []) {
    const { data: statusData } = await supabase
      .from('campaign_prospects')
      .select('pipeline_status')
      .eq('batch_id', batch.id);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const p of statusData || []) {
      counts[p.pipeline_status] = (counts[p.pipeline_status] || 0) + 1;
      total++;
    }
    batch.prospect_count = total;
    batch.status_counts = counts;
  }

  return new Response(JSON.stringify({ batches }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ url }) => {
  const batchId = url.searchParams.get('batch_id');

  if (!batchId) {
    return new Response(JSON.stringify({ error: 'batch_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();

  // Delete prospects first (foreign key constraint)
  const { error: prospectError } = await supabase
    .from('campaign_prospects')
    .delete()
    .eq('batch_id', batchId);

  if (prospectError) {
    return new Response(JSON.stringify({ error: 'Failed to delete prospects', detail: prospectError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete the batch
  const { error: batchError } = await supabase
    .from('campaign_batches')
    .delete()
    .eq('id', batchId);

  if (batchError) {
    return new Response(JSON.stringify({ error: 'Failed to delete batch', detail: batchError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
