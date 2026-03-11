import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { listFiles, moveFile, downloadFile } from '../../../lib/google-drive';
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
 * and schedules directly to Buffer.
 *
 * Processes ONE short per invocation to stay within Vercel's 10s timeout
 * (video must be downloaded from Drive and uploaded to Supabase Storage).
 * Self-triggers for remaining files.
 *
 * Flow per short:
 * 1. Detect first untracked .mp4 in Shorts/Inbox
 * 2. Extract hook text from filename
 * 3. Download video from Drive, upload to Supabase Storage
 * 4. Generate platform captions via Claude
 * 5. Schedule to Buffer (YouTube Shorts + Instagram Reels)
 * 6. Move to Processed
 * 7. Email notification
 * 8. Self-trigger if more files remain
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

    // Find first untracked file
    let targetFile = null;
    for (const file of files) {
      const { data: existing } = await supabase
        .from('content_pipeline')
        .select('id')
        .eq('drive_file_id', file.id)
        .single();

      if (!existing) {
        targetFile = file;
        break;
      }
    }

    if (!targetFile) {
      // No untracked shorts - trigger long-form check
      try {
        await fetch(`${siteUrl}/api/content-pipeline/check-drive-longform`, { method: 'POST' });
      } catch {}

      return new Response(JSON.stringify({ message: 'No new shorts found', processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract hook text from filename
    const hookText = targetFile.name
      .replace(/\.mp4$/i, '')
      .replace(/^riverside_/i, '')
      .replace(/_william[_ ]harvey.*$/i, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .replace(/_/g, ' ')
      .trim();

    // Insert into Supabase
    const { data: row, error: insertErr } = await supabase
      .from('content_pipeline')
      .insert({
        drive_file_id: targetFile.id,
        filename: targetFile.name,
        content_type: 'short',
        status: 'detected',
        hook_text: hookText,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Download from Drive and upload to Supabase Storage
    const driveResponse = await downloadFile(targetFile.id);
    const videoBuffer = await driveResponse.arrayBuffer();
    const storagePath = `shorts/${row.id}.mp4`;

    const { error: uploadErr } = await supabase.storage
      .from('content-videos')
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      });

    if (uploadErr) {
      await supabase
        .from('content_pipeline')
        .update({ status: 'failed', error: `Storage upload: ${uploadErr.message}`, updated_at: new Date().toISOString() })
        .eq('id', row.id);

      return new Response(JSON.stringify({ error: `Storage upload failed: ${uploadErr.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: publicUrlData } = supabase.storage.from('content-videos').getPublicUrl(storagePath);
    const videoUrl = publicUrlData.publicUrl;

    // Generate captions via Claude
    const anthropicKey = getEnv('ANTHROPIC_API_KEY');
    let captions = { youtube: '', instagram: '', tiktok: '' };

    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const captionPrompt = `Here is the hook/topic of a short-form video: "${hookText}"

Write three captions. No hashtags. No emojis. Keep it punchy and direct.
1. YouTube Shorts: 1-2 sentences that make people stop scrolling
2. Instagram Reels: Hook sentence + 2-3 lines of value + call to action
3. TikTok: Conversational, 1-3 sentences, feel native to TikTok

Return as JSON only (no markdown fences): { "youtube": "...", "instagram": "...", "tiktok": "..." }`;

        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: 'You are a social media copywriter for Leadership Growth Consulting, a fractional growth partner helping founders of 3-20 person companies build systems and step back from day-to-day. Tone: direct, punchy, no corporate fluff. Never use em dashes. Never use emojis. Always use British English spellings. Do not reference any apps, tools, or software by name.',
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
          youtube: fallback,
          instagram: `${fallback}\n\nWatch the full video for more.`,
          tiktok: fallback,
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
    // First short: 15 min from now, then 2hr stagger for each subsequent
    publishAt.setMinutes(publishAt.getMinutes() + 15 + (shortIndex * 120));
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

      return new Response(JSON.stringify({ file: targetFile.name, error: bufferErr.message }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const postIds = bufferResults
      .filter(r => r.result.success)
      .map(r => ({ platform: r.platform, postId: r.result.postId }));

    // Move to Processed in Drive
    await moveFile(targetFile.id, inboxFolderId, processedFolderId);

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
        text: `Short "${targetFile.name}" has been scheduled.\n\nHook: ${hookText}\nScheduled for: ${scheduledAt}\nVideo: ${videoUrl}\n\nPlatform results:\n${platformSummary}`,
      });
    } catch {}

    // Check if more untracked files remain - self-trigger for next one
    const remainingFiles = files.filter(f => f.id !== targetFile.id);
    let hasMore = false;
    for (const f of remainingFiles) {
      const { data: ex } = await supabase
        .from('content_pipeline')
        .select('id')
        .eq('drive_file_id', f.id)
        .single();
      if (!ex) {
        hasMore = true;
        break;
      }
    }

    if (hasMore) {
      // Fire-and-forget self-trigger for next file
      fetch(`${siteUrl}/api/content-pipeline/check-drive`, { method: 'POST' }).catch(() => {});
    } else {
      // All shorts done - trigger long-form check
      fetch(`${siteUrl}/api/content-pipeline/check-drive-longform`, { method: 'POST' }).catch(() => {});
    }

    return new Response(JSON.stringify({
      file: targetFile.name,
      status: 'published',
      scheduled_at: scheduledAt,
      video_url: videoUrl,
      remaining: hasMore,
    }), {
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
