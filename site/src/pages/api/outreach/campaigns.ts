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
  const campaignId = url.searchParams.get('campaign_id');

  if (campaignId) {
    // Return prospects for a specific campaign
    const { data: prospects, error } = await supabase
      .from('outreach_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('pipeline_status', { ascending: true })
      .order('company_name', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch prospects', detail: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ prospects: prospects || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return all campaigns
  const { data: campaigns, error } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch campaigns', detail: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ campaigns: campaigns || [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
