import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { listFiles, moveFile, getWebContentLink } from '../../../lib/google-drive';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

const CREATOMATE_API_URL = 'https://api.creatomate.com/v1/renders';
const CREATOMATE_TEMPLATE_ID = 'c7567384-9bb2-4ccd-9f56-322e87abca8e';

/**
 * Cron endpoint: checks Google Drive for new shorts, sends them to Creatomate.
 *
 * POST /api/content-pipeline/check-drive
 *
 * Requires env vars:
 * - DRIVE_SHORTS_INBOX_ID: Google Drive folder ID for /LGC-Content/Shorts/Inbox/
 * - DRIVE_SHORTS_PROCESSING_ID: folder ID for /LGC-Content/Shorts/Processing/
 * - CREATOMATE_API_KEY
 * - SITE_URL: base URL for webhook callback (e.g. https://leadershipgrowthconsulting.com)
 */
// Vercel crons call GET, manual triggers use POST
const handler: APIRoute = async () => {
  const supabase = getSupabase();
  const inboxFolderId = getEnv('DRIVE_SHORTS_INBOX_ID');
  const processingFolderId = getEnv('DRIVE_SHORTS_PROCESSING_ID');
  const creatomateKey = getEnv('CREATOMATE_API_KEY');
  const siteUrl = getEnv('SITE_URL') || 'https://leadershipgrowthconsulting.com';

  if (!inboxFolderId || !processingFolderId || !creatomateKey) {
    return new Response(JSON.stringify({ error: 'Missing required env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. List .mp4 files in Shorts/Inbox
    const files = await listFiles(inboxFolderId);

    if (files.length === 0) {
      return new Response(JSON.stringify({ message: 'No new shorts found', processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const file of files) {
      // 2. Check if already tracked (avoid re-processing)
      const { data: existing } = await supabase
        .from('content_pipeline')
        .select('id')
        .eq('drive_file_id', file.id)
        .single();

      if (existing) {
        results.push({ file: file.name, skipped: 'already tracked' });
        continue;
      }

      // 3. Extract hook text from filename (strip .mp4 extension)
      const hookText = file.name.replace(/\.mp4$/i, '').replace(/_/g, ' ');

      // 4. Insert into Supabase as 'detected'
      const { data: row, error: insertErr } = await supabase
        .from('content_pipeline')
        .insert({
          drive_file_id: file.id,
          filename: file.name,
          content_type: 'short',
          status: 'detected',
          hook_text: hookText,
        })
        .select()
        .single();

      if (insertErr) {
        results.push({ file: file.name, error: insertErr.message });
        continue;
      }

      // 5. Move file to Processing folder
      await moveFile(file.id, inboxFolderId, processingFolderId);

      // 6. Get a download URL for Creatomate
      const downloadUrl = await getWebContentLink(file.id);

      // 7. Send to Creatomate with webhook
      const webhookUrl = `${siteUrl}/api/content-pipeline/creatomate-webhook`;

      const renderRes = await fetch(CREATOMATE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${creatomateKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: CREATOMATE_TEMPLATE_ID,
          webhook_url: webhookUrl,
          metadata: row.id, // Pass our DB row ID so webhook can match it
          modifications: {
            'Video-1': downloadUrl,
            'Visual-Hook': hookText,
          },
        }),
      });

      if (!renderRes.ok) {
        const errText = await renderRes.text();
        await supabase
          .from('content_pipeline')
          .update({ status: 'failed', error: `Creatomate error: ${errText}` })
          .eq('id', row.id);
        results.push({ file: file.name, error: `Creatomate: ${errText}` });
        continue;
      }

      const renderData = await renderRes.json();
      const renderId = Array.isArray(renderData) ? renderData[0]?.id : renderData?.id;

      // 8. Update status to 'processing'
      await supabase
        .from('content_pipeline')
        .update({
          status: 'processing',
          creatomate_render_id: renderId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      results.push({ file: file.name, status: 'sent_to_creatomate', render_id: renderId });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('check-drive error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET = handler;
export const POST = handler;
