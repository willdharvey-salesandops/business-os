import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const POST: APIRoute = async ({ request }) => {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { subject, preview_text, body_markdown, cta_text, slug: customSlug, publish, session_id } = await request.json();

  if (!subject || !body_markdown) {
    return new Response(JSON.stringify({ error: 'subject and body_markdown are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const slug = customSlug || slugify(subject);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const row: Record<string, any> = {
      subject,
      preview_text: preview_text || '',
      slug,
      body_markdown,
      cta_text: cta_text || '',
      session_id: session_id || null,
    };

    if (publish) {
      row.published = true;
      row.published_at = new Date().toISOString();
    }

    // Upsert by slug so re-publishing updates the existing row
    const { data, error } = await supabase
      .from('newsletters')
      .upsert(row, { onConflict: 'slug' })
      .select('id, slug')
      .single();

    if (error) {
      console.error('Newsletter upsert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to save newsletter', detail: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      id: data.id,
      slug: data.slug,
      url: `/newsletter/${data.slug}`,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Newsletter publish error:', err);
    return new Response(JSON.stringify({ error: 'Newsletter publish failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
