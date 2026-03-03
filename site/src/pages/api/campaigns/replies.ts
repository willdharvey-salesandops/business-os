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
  const batchId = url.searchParams.get('batch_id');

  if (!batchId) {
    return new Response(JSON.stringify({ error: 'batch_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const instantlyKey = getEnv('INSTANTLY_API_KEY');
  if (!instantlyKey) {
    return new Response(JSON.stringify({ error: 'Instantly API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();

  // Get the batch to find the Instantly campaign ID
  const { data: batch, error: batchError } = await supabase
    .from('campaign_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    return new Response(JSON.stringify({ error: 'Batch not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!batch.instantly_campaign_id) {
    return new Response(JSON.stringify({ error: 'Batch has not been pushed to Instantly yet' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch replies from Instantly API v2
    const repliesRes = await fetch(
      `https://api.instantly.ai/api/v2/emails?campaign_id=${batch.instantly_campaign_id}&email_type=reply&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${instantlyKey}`,
        },
      }
    );

    if (!repliesRes.ok) {
      const errText = await repliesRes.text();
      return new Response(JSON.stringify({ error: 'Failed to fetch replies from Instantly', detail: errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repliesData = await repliesRes.json();
    const replies = repliesData.data || repliesData.items || repliesData || [];

    // Get all prospects in this batch for matching
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, email, company_name, first_name, last_name')
      .eq('batch_id', batchId);

    const emailMap = new Map<string, any>();
    for (const p of prospects || []) {
      if (p.email) emailMap.set(p.email.toLowerCase(), p);
    }

    // Match replies to prospects and update
    const matched: Array<{ prospect_id: string; company: string; from: string; snippet: string }> = [];

    for (const reply of Array.isArray(replies) ? replies : []) {
      const fromEmail = (reply.from_email || reply.from || '').toLowerCase();
      const prospect = emailMap.get(fromEmail);

      if (prospect && !prospect.replied) {
        const replyText = reply.body || reply.text || reply.snippet || '';

        await supabase
          .from('campaign_prospects')
          .update({
            replied: true,
            reply_text: replyText.substring(0, 2000),
            pipeline_status: 'replied',
          })
          .eq('id', prospect.id);

        matched.push({
          prospect_id: prospect.id,
          company: prospect.company_name,
          from: fromEmail,
          snippet: replyText.substring(0, 200),
        });
      }
    }

    return new Response(JSON.stringify({
      campaign_id: batch.instantly_campaign_id,
      total_replies: Array.isArray(replies) ? replies.length : 0,
      matched_to_prospects: matched.length,
      replies: matched,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Replies fetch error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch replies', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
