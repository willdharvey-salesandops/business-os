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
  const { prospect_id, subject, body, owner_email, status: targetStatus } = await request.json();

  if (!prospect_id) {
    return new Response(JSON.stringify({ error: 'prospect_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowedStatuses = ['approved', 'disqualified'];
  const finalStatus = allowedStatuses.includes(targetStatus) ? targetStatus : 'approved';

  const supabase = getSupabase();

  const updates: Record<string, string> = { pipeline_status: finalStatus };
  if (subject) updates.draft_subject = subject;
  if (body) updates.draft_body = body;
  if (owner_email) updates.owner_email = owner_email;

  const { error } = await supabase
    .from('outreach_prospects')
    .update(updates)
    .eq('id', prospect_id);

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to update', detail: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ prospect_id, status: finalStatus }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
