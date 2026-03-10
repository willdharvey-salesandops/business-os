import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { moveFile, revokePublicAccess } from '../../../lib/google-drive';
import { scheduleShortToAllPlatforms } from '../../../lib/buffer-api';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * Webhook endpoint called by Creatomate when a render completes.
 *
 * POST /api/content-pipeline/creatomate-webhook
 *
 * Creatomate sends: { id, status, url, metadata, ... }
 * metadata contains our Supabase row ID.
 *
 * On success:
 * 1. Save rendered video URL
 * 2. Generate platform captions via Claude
 * 3. Schedule to Buffer (YouTube Shorts, Instagram Reels, TikTok)
 * 4. Move original file to Processed folder
 * 5. Clean up Drive sharing permissions
 */
export const POST: APIRoute = async ({ request }) => {
  const supabase = getSupabase();

  try {
    const payload = await request.json();
    const renderId = payload.id;
    const status = payload.status;
    const videoUrl = payload.url;
    const rowId = payload.metadata; // Our Supabase row ID

    if (!rowId) {
      return new Response(JSON.stringify({ error: 'No metadata (row ID) in webhook' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the pipeline row
    const { data: row, error: fetchErr } = await supabase
      .from('content_pipeline')
      .select('*')
      .eq('id', rowId)
      .single();

    if (fetchErr || !row) {
      return new Response(JSON.stringify({ error: 'Pipeline row not found', rowId }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle failed renders
    if (status === 'failed') {
      await supabase
        .from('content_pipeline')
        .update({
          status: 'failed',
          error: payload.error_message || 'Creatomate render failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', rowId);

      return new Response(JSON.stringify({ received: true, status: 'failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only process succeeded renders
    if (status !== 'succeeded') {
      return new Response(JSON.stringify({ received: true, status, message: 'Not a final status' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract transcript from Creatomate payload if available
    // Creatomate includes transcript data in the webhook for renders with auto-subtitles
    let transcript = '';
    try {
      const elements = payload.snapshot?.source?.elements || payload.elements || [];
      for (const el of elements) {
        if (el.transcript_source || el.name === 'Captions') {
          transcript = el.text || '';
          break;
        }
      }
      // Also check top-level transcript field
      if (!transcript && payload.transcript) {
        transcript = payload.transcript;
      }
    } catch {
      // Best effort transcript extraction
    }

    // Update with rendered video URL and transcript
    await supabase
      .from('content_pipeline')
      .update({
        status: 'rendered',
        rendered_video_url: videoUrl,
        transcript: transcript || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rowId);

    // --- STEP 1: Generate captions via Claude ---
    const anthropicKey = getEnv('ANTHROPIC_API_KEY');
    let captions = { youtube: '', instagram: '', tiktok: '' };

    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });

        // Use transcript if available, fall back to hook text
        const contentBasis = transcript
          ? `Here is the transcript of a short-form video: "${transcript}"\n\nThe hook/topic is: "${row.hook_text}"`
          : `Here is the hook/topic of a short-form video: "${row.hook_text}"`;

        const captionPrompt = `${contentBasis}

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
        // Fallback captions using hook text
        const fallback = row.hook_text || 'New video';
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', rowId);

    // --- STEP 2: Schedule to Buffer ---
    // Calculate publish time: 1hr from now for first short, stagger by 2hr based on count of today's published shorts
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
      bufferResults = await scheduleShortToAllPlatforms(captions, videoUrl, scheduledAt, row.hook_text);
    } catch (bufferErr: any) {
      console.error('Buffer scheduling failed:', bufferErr.message);
      await supabase
        .from('content_pipeline')
        .update({
          status: 'failed',
          error: `Buffer error: ${bufferErr.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rowId);

      return new Response(JSON.stringify({ received: true, error: bufferErr.message }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const postIds = bufferResults
      .filter(r => r.result.success)
      .map(r => ({ platform: r.platform, postId: r.result.postId }));

    // --- STEP 3: Move file to Processed and clean up ---
    const processingFolderId = getEnv('DRIVE_SHORTS_PROCESSING_ID');
    const processedFolderId = getEnv('DRIVE_SHORTS_PROCESSED_ID');

    if (processingFolderId && processedFolderId) {
      try {
        await moveFile(row.drive_file_id, processingFolderId, processedFolderId);
      } catch (moveErr: any) {
        console.error('Failed to move file to Processed:', moveErr.message);
      }
    }

    // Revoke public access on the Drive file
    try {
      await revokePublicAccess(row.drive_file_id);
    } catch {
      // Best effort
    }

    // --- STEP 4: Update final status ---
    await supabase
      .from('content_pipeline')
      .update({
        status: 'published',
        buffer_post_ids: postIds,
        scheduled_publish_at: scheduledAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rowId);

    // --- STEP 5: Send notification email ---
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
        subject: `Short published: ${row.hook_text}`,
        text: `Short "${row.filename}" has been processed and scheduled.\n\nHook: ${row.hook_text}\nScheduled for: ${scheduledAt}\nVideo: ${videoUrl}\n\nPlatform results:\n${platformSummary}`,
      });
    } catch {
      // Email notification is best-effort
    }

    return new Response(JSON.stringify({
      received: true,
      status: 'published',
      video_url: videoUrl,
      captions,
      scheduled_at: scheduledAt,
      buffer_results: bufferResults,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Creatomate webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
