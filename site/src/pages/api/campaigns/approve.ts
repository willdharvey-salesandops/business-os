import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

export const POST: APIRoute = async ({ request }) => {
  const { prospect_id, prospect_ids, batch_id, action = 'approve', edits } = await request.json();

  const supabase = getSupabase();

  // Single prospect approval with optional edits
  if (prospect_id) {
    const updateData: Record<string, any> = {
      pipeline_status: action === 'skip' ? 'disqualified' : 'approved',
    };

    // Apply any inline edits
    if (edits) {
      if (edits.draft_subject) updateData.draft_subject = edits.draft_subject;
      if (edits.draft_body) updateData.draft_body = edits.draft_body;
      if (edits.follow_up_1_subject) updateData.follow_up_1_subject = edits.follow_up_1_subject;
      if (edits.follow_up_1_body) updateData.follow_up_1_body = edits.follow_up_1_body;
      if (edits.follow_up_2_subject) updateData.follow_up_2_subject = edits.follow_up_2_subject;
      if (edits.follow_up_2_body) updateData.follow_up_2_body = edits.follow_up_2_body;
    }

    const { error } = await supabase
      .from('campaign_prospects')
      .update(updateData)
      .eq('id', prospect_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      prospect_id,
      status: updateData.pipeline_status,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Bulk approval by prospect_ids array
  if (prospect_ids?.length) {
    const { error } = await supabase
      .from('campaign_prospects')
      .update({ pipeline_status: 'approved' })
      .in('id', prospect_ids);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      approved: prospect_ids.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Bulk approval by batch_id (all analyzed prospects)
  if (batch_id) {
    const { data: prospects, error: fetchError } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('batch_id', batch_id)
      .eq('pipeline_status', 'analyzed');

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!prospects?.length) {
      return new Response(JSON.stringify({ approved: 0, note: 'No analyzed prospects to approve' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ids = prospects.map(p => p.id);
    const { error } = await supabase
      .from('campaign_prospects')
      .update({ pipeline_status: 'approved' })
      .in('id', ids);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      approved: ids.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'prospect_id, prospect_ids, or batch_id required' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};
