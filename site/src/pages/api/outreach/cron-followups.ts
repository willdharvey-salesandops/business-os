import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
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
${paragraphs.map((p: string) => `<p style="margin: 0 0 16px 0;">${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
</div>`;
}

export const POST: APIRoute = async () => {
  const gmailAddress = getEnv('GMAIL_ADDRESS');
  const gmailPassword = getEnv('GMAIL_APP_PASSWORD');

  if (!gmailAddress || !gmailPassword) {
    return new Response(JSON.stringify({ error: 'Gmail credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();
  const now = new Date();
  const results: Array<{ prospect_id: string; company: string; follow_up: number; status: string }> = [];

  // Find all sent prospects that haven't replied and have follow-ups pending
  const { data: prospects, error } = await supabase
    .from('outreach_prospects')
    .select('*')
    .eq('pipeline_status', 'sent')
    .eq('replied', false)
    .not('sent_at', 'is', null);

  if (error || !prospects) {
    return new Response(JSON.stringify({ error: 'Failed to fetch prospects', detail: error?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailAddress, pass: gmailPassword },
  });

  for (const prospect of prospects) {
    if (!prospect.owner_email) continue;

    const sentAt = new Date(prospect.sent_at);
    const daysSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);

    // Follow-up 1: 2 days after initial send
    if (
      daysSinceSent >= 2 &&
      !prospect.follow_up_1_sent_at &&
      prospect.follow_up_1_body
    ) {
      try {
        await transporter.sendMail({
          from: `Will Harvey <${gmailAddress}>`,
          to: prospect.owner_email,
          subject: prospect.follow_up_1_subject || prospect.draft_subject,
          html: buildHtml(prospect.follow_up_1_body),
        });

        await supabase
          .from('outreach_prospects')
          .update({ follow_up_1_sent_at: now.toISOString() })
          .eq('id', prospect.id);

        results.push({
          prospect_id: prospect.id,
          company: prospect.company_name,
          follow_up: 1,
          status: 'sent',
        });
      } catch (err: any) {
        results.push({
          prospect_id: prospect.id,
          company: prospect.company_name,
          follow_up: 1,
          status: `failed: ${err?.message}`,
        });
      }

      // Small delay between sends
      await new Promise(r => setTimeout(r, 1000));
    }

    // Follow-up 2: 5 days after initial send
    if (
      daysSinceSent >= 5 &&
      !prospect.follow_up_2_sent_at &&
      prospect.follow_up_2_body &&
      prospect.follow_up_1_sent_at // Only send FU2 if FU1 was already sent
    ) {
      try {
        await transporter.sendMail({
          from: `Will Harvey <${gmailAddress}>`,
          to: prospect.owner_email,
          subject: prospect.follow_up_2_subject || prospect.draft_subject,
          html: buildHtml(prospect.follow_up_2_body),
        });

        await supabase
          .from('outreach_prospects')
          .update({ follow_up_2_sent_at: now.toISOString() })
          .eq('id', prospect.id);

        results.push({
          prospect_id: prospect.id,
          company: prospect.company_name,
          follow_up: 2,
          status: 'sent',
        });
      } catch (err: any) {
        results.push({
          prospect_id: prospect.id,
          company: prospect.company_name,
          follow_up: 2,
          status: `failed: ${err?.message}`,
        });
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return new Response(JSON.stringify({
    checked: prospects.length,
    follow_ups_sent: results.filter(r => r.status === 'sent').length,
    results,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
