import type { APIRoute } from 'astro';
import { listFilesByType, exportAsText, downloadFile } from '../../../lib/google-drive';

export const prerender = false;

const MEET_RECORDINGS_FOLDER = '18SD4-7jd3AYIPVkYbLDtXVIVNkd5oktY';

// Google Meet saves transcripts as Google Docs, and sometimes .txt or .sbv files
const TRANSCRIPT_MIME_TYPES = [
  'application/vnd.google-apps.document', // Google Doc transcript
  'text/plain',                            // Plain text transcript
];

export const GET: APIRoute = async () => {
  try {
    const files = await listFilesByType(MEET_RECORDINGS_FOLDER, TRANSCRIPT_MIME_TYPES);

    const transcripts = files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.mimeType === 'application/vnd.google-apps.document' ? 'google_doc' : 'text',
      date: f.createdTime,
    }));

    return new Response(JSON.stringify({ success: true, transcripts }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('List recordings error:', err);
    return new Response(JSON.stringify({ error: 'Failed to list recordings', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const { file_id, file_type } = await request.json();
  if (!file_id) {
    return new Response(JSON.stringify({ error: 'file_id is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let text: string;

    if (file_type === 'google_doc') {
      text = await exportAsText(file_id);
    } else {
      const res = await downloadFile(file_id);
      text = await res.text();
    }

    return new Response(JSON.stringify({ success: true, text }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Fetch transcript error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch transcript', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
