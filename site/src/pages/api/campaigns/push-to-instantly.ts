import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

function buildHtml(body: string): string {
  const paragraphs = body
    .split(/\n\n+/)
    .map((para: string) => para.trim())
    .filter((para: string) => para.length > 0);

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; max-width: 560px; line-height: 1.6; font-size: 14px;">
${paragraphs.map((p: string) => `<p style="margin: 0 0 16px 0;">${p.replace(/\n- /g, '<br>- ').replace(/\n/g, '<br>')}</p>`).join('\n')}
</div>`;
}

export const POST: APIRoute = async ({ request }) => {
  const { batch_id, campaign_name } = await request.json();

  if (!batch_id) {
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

  const sendingAccounts = getEnv('SENDING_ACCOUNTS')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sendingAccounts.length === 0) {
    return new Response(JSON.stringify({ error: 'No sending accounts configured (SENDING_ACCOUNTS)' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();

  // Get all approved prospects in this batch
  const { data: prospects, error: fetchError } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('batch_id', batch_id)
    .eq('pipeline_status', 'approved');

  if (fetchError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch prospects', detail: fetchError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!prospects?.length) {
    return new Response(JSON.stringify({ error: 'No approved prospects to push' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate all prospects have emails and drafts
  const invalid = prospects.filter(p => !p.email || !p.draft_body);
  if (invalid.length > 0) {
    return new Response(JSON.stringify({
      error: `${invalid.length} prospects missing email or draft`,
      missing: invalid.map(p => ({ id: p.id, company: p.company_name, email: !!p.email, draft: !!p.draft_body })),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Step 1: Create Instantly campaign (PAUSED) with 3-step sequence using custom variables
    const name = campaign_name || `LGC ${new Date().toISOString().slice(0, 10)}`;

    const campaignBody = {
      name,
      campaign_schedule: {
        schedules: [{
          name: 'Default',
          timing: { from: '08:00', to: '17:00' },
          days: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
          },
          timezone: 'Europe/London',
        }],
      },
      sequences: [{
        steps: [
          {
            type: 'email',
            delay: 0,
            variants: [{
              subject: '{{subject_1}}',
              body: '{{body_1}}',
            }],
          },
          {
            type: 'email',
            delay: 2,
            variants: [{
              subject: '{{subject_2}}',
              body: '{{body_2}}',
            }],
          },
          {
            type: 'email',
            delay: 3,
            variants: [{
              subject: '{{subject_3}}',
              body: '{{body_3}}',
            }],
          },
        ],
      }],
    };

    const campaignRes = await fetch('https://api.instantly.ai/api/v2/campaigns', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instantlyKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campaignBody),
    });

    if (!campaignRes.ok) {
      const errText = await campaignRes.text();
      return new Response(JSON.stringify({
        error: 'Failed to create Instantly campaign',
        detail: errText,
        status_code: campaignRes.status,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const campaign = await campaignRes.json();
    const campaignId = campaign.id;

    // Step 2: Assign sending accounts to the campaign
    for (const account of sendingAccounts) {
      try {
        await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/accounts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${instantlyKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email_account: account }),
        });
      } catch (err) {
        console.error(`Failed to assign account ${account}:`, err);
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // Step 3: Upload leads in batches with custom variables
    const results: Array<{ prospect_id: string; company: string; status: string }> = [];
    const batchSize = 100;

    for (let i = 0; i < prospects.length; i += batchSize) {
      const chunk = prospects.slice(i, i + batchSize);

      for (const prospect of chunk) {
        try {
          const leadBody = {
            email: prospect.email,
            campaign: campaignId,
            first_name: prospect.first_name || '',
            last_name: prospect.last_name || '',
            company_name: prospect.company_name || '',
            custom_variables: {
              subject_1: prospect.draft_subject || '',
              body_1: buildHtml(prospect.draft_body || ''),
              subject_2: prospect.follow_up_1_subject || prospect.draft_subject || '',
              body_2: buildHtml(prospect.follow_up_1_body || ''),
              subject_3: prospect.follow_up_2_subject || prospect.draft_subject || '',
              body_3: buildHtml(prospect.follow_up_2_body || ''),
            },
          };

          const leadRes = await fetch('https://api.instantly.ai/api/v2/leads', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${instantlyKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(leadBody),
          });

          if (leadRes.ok) {
            results.push({ prospect_id: prospect.id, company: prospect.company_name, status: 'uploaded' });
          } else {
            const errText = await leadRes.text();
            results.push({ prospect_id: prospect.id, company: prospect.company_name, status: `failed: ${errText}` });
          }
        } catch (err: any) {
          results.push({ prospect_id: prospect.id, company: prospect.company_name, status: `error: ${err?.message}` });
        }

        // Small delay between leads to respect rate limits
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Step 4: Update prospect statuses to pushed
    const uploadedIds = results
      .filter(r => r.status === 'uploaded')
      .map(r => r.prospect_id);

    if (uploadedIds.length > 0) {
      await supabase
        .from('campaign_prospects')
        .update({
          pipeline_status: 'pushed',
          pushed_at: new Date().toISOString(),
        })
        .in('id', uploadedIds);
    }

    // Update batch with campaign ID
    await supabase
      .from('campaign_batches')
      .update({
        instantly_campaign_id: campaignId,
        instantly_pushed_at: new Date().toISOString(),
      })
      .eq('id', batch_id);

    const uploaded = results.filter(r => r.status === 'uploaded').length;
    const failed = results.filter(r => r.status !== 'uploaded').length;

    return new Response(JSON.stringify({
      campaign_id: campaignId,
      campaign_name: name,
      total_prospects: prospects.length,
      uploaded,
      failed,
      sending_accounts: sendingAccounts.length,
      results: failed > 0 ? results.filter(r => r.status !== 'uploaded') : [],
      note: 'Campaign created PAUSED. Activate in Instantly when ready.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Push to Instantly error:', err);
    return new Response(JSON.stringify({ error: 'Push failed', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
