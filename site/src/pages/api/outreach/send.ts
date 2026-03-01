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

export const POST: APIRoute = async ({ request }) => {
  const { prospect_id } = await request.json();

  if (!prospect_id) {
    return new Response(JSON.stringify({ error: 'prospect_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gmailAddress = getEnv('GMAIL_ADDRESS');
  const gmailPassword = getEnv('GMAIL_APP_PASSWORD');

  if (!gmailAddress || !gmailPassword) {
    return new Response(JSON.stringify({ error: 'Gmail credentials not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();

  // Read prospect
  const { data: prospect, error: readError } = await supabase
    .from('outreach_prospects')
    .select('*')
    .eq('id', prospect_id)
    .single();

  if (readError || !prospect) {
    return new Response(JSON.stringify({ error: 'Prospect not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (prospect.pipeline_status !== 'approved') {
    return new Response(JSON.stringify({ error: 'Prospect must be approved before sending' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!prospect.owner_email) {
    return new Response(JSON.stringify({ error: 'No email address for this prospect' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailAddress, pass: gmailPassword },
    });

    // Wrap plain text body in minimal HTML with proper paragraph spacing
    const paragraphs = prospect.draft_body
      .split(/\n\n+/)
      .map((para: string) => para.trim())
      .filter((para: string) => para.length > 0);

    const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; max-width: 560px; line-height: 1.6; font-size: 14px;">
${paragraphs.map((p: string) => `<p style="margin: 0 0 16px 0;">${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
</div>`;

    await transporter.sendMail({
      from: `Will Harvey <${gmailAddress}>`,
      to: prospect.owner_email,
      subject: prospect.draft_subject,
      html: htmlBody,
    });

    // Update status
    await supabase
      .from('outreach_prospects')
      .update({
        pipeline_status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', prospect_id);

    return new Response(JSON.stringify({
      prospect_id,
      status: 'sent',
      to: prospect.owner_email,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Send error:', err);

    await supabase
      .from('outreach_prospects')
      .update({ pipeline_status: 'failed' })
      .eq('id', prospect_id);

    return new Response(JSON.stringify({ error: 'Send failed', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
