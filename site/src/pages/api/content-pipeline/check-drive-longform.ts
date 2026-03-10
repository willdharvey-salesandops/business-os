import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { listFiles, listImageFiles, moveFile } from '../../../lib/google-drive';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

/**
 * Detect long-form videos in Google Drive, generate YouTube SEO metadata,
 * and email ready-to-paste details for YouTube Studio upload.
 *
 * Triggered by check-drive.ts after shorts processing.
 *
 * Flow:
 * 1. List .mp4 files in Long-Form/Inbox
 * 2. Match each with a thumbnail (.jpg/.png, same base name)
 * 3. If no thumbnail → email alert, skip
 * 4. Generate SEO (title, description, tags) via Claude
 * 5. Move files to Processed
 * 6. Email Will with metadata + Drive links
 */
const handler: APIRoute = async () => {
  const supabase = getSupabase();
  const inboxFolderId = getEnv('DRIVE_LONGFORM_INBOX_ID');
  const processedFolderId = getEnv('DRIVE_LONGFORM_PROCESSED_ID');

  if (!inboxFolderId || !processedFolderId) {
    return new Response(JSON.stringify({ error: 'Missing DRIVE_LONGFORM_INBOX_ID or DRIVE_LONGFORM_PROCESSED_ID' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const videos = await listFiles(inboxFolderId);

    if (videos.length === 0) {
      return new Response(JSON.stringify({ message: 'No new long-form videos', processed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const images = await listImageFiles(inboxFolderId);
    const results: any[] = [];

    // Process only the first untracked video per invocation (stay within 10s timeout)
    for (const video of videos) {
      const { data: existing } = await supabase
        .from('content_pipeline')
        .select('id')
        .eq('drive_file_id', video.id)
        .single();

      if (existing) {
        results.push({ file: video.name, skipped: 'already tracked' });
        continue;
      }

      // Match thumbnail by base name (case-insensitive)
      const baseName = video.name.replace(/\.mp4$/i, '');
      const thumbnail = images.find(img => {
        const imgBase = img.name.replace(/\.(jpg|jpeg|png)$/i, '');
        return imgBase.toLowerCase() === baseName.toLowerCase();
      });

      if (!thumbnail) {
        // Alert Will - no thumbnail found
        try {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.default.createTransport({
            service: 'gmail',
            auth: {
              user: getEnv('GMAIL_ADDRESS'),
              pass: getEnv('GMAIL_APP_PASSWORD'),
            },
          });
          await transporter.sendMail({
            from: getEnv('GMAIL_ADDRESS'),
            to: getEnv('GMAIL_ADDRESS'),
            subject: `Missing thumbnail: ${video.name}`,
            text: `No matching thumbnail found for "${video.name}".\n\nDrop a .jpg or .png with the same base name in the Long-Form/Inbox folder.\n\nExpected: "${baseName}.jpg" or "${baseName}.png"`,
          });
        } catch {}

        results.push({ file: video.name, error: 'No matching thumbnail' });
        continue;
      }

      // Extract hook text from filename
      const hookText = baseName.replace(/_/g, ' ');

      // Insert into Supabase
      const { data: row, error: insertErr } = await supabase
        .from('content_pipeline')
        .insert({
          drive_file_id: video.id,
          filename: video.name,
          content_type: 'longform',
          status: 'detected',
          hook_text: hookText,
        })
        .select()
        .single();

      if (insertErr) {
        results.push({ file: video.name, error: insertErr.message });
        continue;
      }

      // Generate SEO metadata via Claude
      const anthropicKey = getEnv('ANTHROPIC_API_KEY');
      let seoData = { title: hookText, description: '', tags: [] as string[] };

      if (anthropicKey) {
        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey });
          const msg = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            system: 'You are a YouTube SEO specialist for Leadership Growth Consulting, a fractional growth partner helping founders of 2-20 person companies build systems, step back from day-to-day operations, and scale. Tone: direct, practical, no corporate fluff. Never use em dashes. Always use British English spellings.',
            messages: [{
              role: 'user',
              content: `Generate YouTube SEO metadata for a long-form video with this topic: "${hookText}"

Return JSON only (no markdown fences): { "title": "...", "description": "...", "tags": ["...", "..."] }

Title: Compelling, under 60 characters, include the core keyword. Do not wrap in quotes.
Description: 2-3 paragraphs. Start with a strong hook sentence. Include a "[TIMESTAMPS]" placeholder on its own line. End with a call to action to subscribe and visit leadershipgrowthconsulting.com. Include relevant keywords naturally.
Tags: 10-15 relevant tags for YouTube search discovery.`,
            }],
          });

          const rawText = (msg.content[0] as any).text || '';
          const jsonStart = rawText.indexOf('{');
          const jsonEnd = rawText.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            seoData = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
          }
        } catch (seoErr: any) {
          console.error('SEO generation failed:', seoErr.message);
        }
      }

      // Update with SEO data
      await supabase
        .from('content_pipeline')
        .update({
          status: 'seo_generated',
          seo_data: seoData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      // Move both files to Processed
      await moveFile(video.id, inboxFolderId, processedFolderId);
      await moveFile(thumbnail.id, inboxFolderId, processedFolderId);

      // Email Will with ready-to-paste metadata + Drive links
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          service: 'gmail',
          auth: {
            user: getEnv('GMAIL_ADDRESS'),
            pass: getEnv('GMAIL_APP_PASSWORD'),
          },
        });

        const tagsFormatted = (seoData.tags || []).join(', ');

        await transporter.sendMail({
          from: getEnv('GMAIL_ADDRESS'),
          to: getEnv('GMAIL_ADDRESS'),
          subject: `YouTube ready: ${seoData.title}`,
          text: `Your long-form video is ready for YouTube upload.\n\n` +
            `TITLE:\n${seoData.title}\n\n` +
            `DESCRIPTION:\n${seoData.description}\n\n` +
            `TAGS:\n${tagsFormatted}\n\n` +
            `---\n\n` +
            `Upload here: https://studio.youtube.com/channel/upload\n\n` +
            `Video: https://drive.google.com/file/d/${video.id}/view\n` +
            `Thumbnail: https://drive.google.com/file/d/${thumbnail.id}/view`,
        });
      } catch {}

      await supabase
        .from('content_pipeline')
        .update({
          status: 'ready_for_upload',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      results.push({ file: video.name, status: 'ready_for_upload', seo: seoData });

      // Only process one video per invocation to stay within timeout
      break;
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('check-drive-longform error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET = handler;
export const POST = handler;
