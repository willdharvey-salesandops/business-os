import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { listFiles, moveFile, getWebContentLink } from '../../../lib/google-drive';
import { scheduleShortToAllPlatforms } from '../../../lib/buffer-api';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * Cron endpoint: checks Google Drive for new shorts, generates captions,
 * and schedules directly to Buffer. No Creatomate step.
 *
 * Shorts should already have captions/hooks baked in (e.g. from Riverside).
 *
 * Flow per short:
 * 1. Detect .mp4 in Shorts/Inbox
 * 2. Extract hook text from filename
 * 3. Make file publicly accessible for Buffer
 * 4. Generate platform captions via Claude
 * 5. Schedule to Buffer (YouTube Shorts + Instagram Reels)
 * 6. Move to Processed, revoke public access
 * 7. Email notification
 */
const handler: APIRoute = async () => {
  const supabase = getSupabase();
  const inboxFolderId = getEnv('DRIVE_SHORTS_INBOX_ID');
  const processedFolderId = getEnv('DRIVE_SHORTS_PROCESSED_ID');
  const siteUrl = getEnv('SITE_URL') || 'https://leadershipgrowthconsulting.com';

  if (!inboxFolderId || !processedFolderId) {
    return new Response(JSON.stringify({ error: 'Missing required env vars' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const files = await listFiles(inboxFolderId);

    if (files.length === 0) {
      // Still trigger long-form check even if no shorts
      try {
        await fetch(`${siteUrl}/api/content-pipeline/check-drive-longform`, { method: 'POST' });
      } catch {}

      return new Response(JSON.stringify({ message: 'No new shorts found', processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const file of files) {
      // Check if already tracked
      const { data: existing } = await supabase
        .from('content_pipeline')
        .select('id')
        .eq('drive_file_id', file.id)
        .single();

      if (existing) {
        results.push({ file: file.name, skipped: 'already tracked' });
        continue;
      }

      // Extract hook text from filename
      const hookText = file.name.replace(/\.mp4$/i, '').replace(/_/g, ' ');

      // Insert into Supabase
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

      // Get a public download URL for Buffer
      const videoUrl = await getWebContentLink(file.id);

      // Generate captions via Claude
      const anthropicKey = getEnv('ANTHROPIC_API_KEY');
      let captions = { youtube: '', instagram: '', tiktok: '' };

      if (anthropicKey) {
        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey });
          const captionPrompt = `Here is the hook/topic of a short-form video: "${hookText}"

Write three captions:
1. YouTube Shorts: 1-2 punchy sentences + 3-5 relevant hashtags
2. Instagram Reels: Hook sentence + 2-3 lines of value + call to action + 10-15 hashtags
3. TikTok: Conversational, 1-3 sentences, 3-5 hashtags, feel native to TikTok

Return as JSON only (no markdown fences): { "youtube": "...", "instagram": "...", "tiktok": "..." }`;

          const msg = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            system: 'You are a social media copywriter for Leadership Growth Consulting, a fractional growth partner business helping founders and business owners of 2-20 person companies. Tone: direct, punchy, no corporate fluff. Never use em dashes. Always use British English spellings.',
            messages: [{ role: 'user', content: captionPrompt }],
          });

          const rawText = (msg.content[0] as any).text || '';
          const jsonStart = rawText.indexOf('{');
          const jsonEnd = rawText.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            captions = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
          }
        } catch (captionErr: any) {
          console.error('Caption generation failed:', captionErr.message);
          const fallback = hookText || 'New video';
          captions = {
            youtube: `${fallback} #business #leadership #growth`,
            instagram: `${fallback}\n\nWatch the full video for more.\n\n#business #leadership #growth #smallbusiness #entrepreneur`,
            tiktok: `${fallback} #business #leadership #growth`,
          };
        }
      }

      await supabase
        .from('content_pipeline')
        .update({
          status: 'captioned',
          captions,
          rendered_video_url: videoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      // Schedule to Buffer
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from('content_pipeline')
        .select('*', { count: 'exact', head: true })
        .eq('content_type', 'short')
        .gte('created_at', `${today}T00:00:00Z`)
        .in('status', ['publishing', 'published']);

      const shortIndex = count || 0;
      const publishAt = new Date();
      publishAt.setHours(publishAt.getHours() + 1 + (shortIndex * 2));
      const scheduledAt = publishAt.toISOString();

      let bufferResults: any[] = [];
      try {
        bufferResults = await scheduleShortToAllPlatforms(captions, videoUrl, scheduledAt, hookText);
      } catch (bufferErr: any) {
        console.error('Buffer scheduling failed:', bufferErr.message);
        await supabase
          .from('content_pipeline')
          .update({
            status: 'failed',
            error: `Buffer error: ${bufferErr.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        results.push({ file: file.name, error: `Buffer: ${bufferErr.message}` });
        continue;
      }

      const postIds = bufferResults
        .filter(r => r.result.success)
        .map(r => ({ platform: r.platform, postId: r.result.postId }));

      // Move to Processed
      await moveFile(file.id, inboxFolderId, processedFolderId);

      // Note: keeping file public so Buffer can fetch it when publishing
      // Public access is on files in the Processed folder only

      // Update final status
      await supabase
        .from('content_pipeline')
        .update({
          status: 'published',
          buffer_post_ids: postIds,
          scheduled_publish_at: scheduledAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      // Email notification
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          service: 'gmail',
          auth: {
            user: getEnv('GMAIL_ADDRESS'),
            pass: getEnv('GMAIL_APP_PASSWORD'),
          },
        });

        const platformSummary = bufferResults
          .map(r => `${r.platform}: ${r.result.success ? 'Scheduled' : `Failed - ${r.result.error}`}`)
          .join('\n');

        await transporter.sendMail({
          from: getEnv('GMAIL_ADDRESS'),
          to: getEnv('GMAIL_ADDRESS'),
          subject: `Short published: ${hookText}`,
          text: `Short "${file.name}" has been scheduled.\n\nHook: ${hookText}\nScheduled for: ${scheduledAt}\nVideo: ${videoUrl}\n\nPlatform results:\n${platformSummary}`,
        });
      } catch {}

      results.push({ file: file.name, status: 'published', scheduled_at: scheduledAt });
    }

    // Trigger long-form check
    try {
      await fetch(`${siteUrl}/api/content-pipeline/check-drive-longform`, { method: 'POST' });
    } catch {}

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
