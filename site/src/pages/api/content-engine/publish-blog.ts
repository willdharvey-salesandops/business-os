import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

export const POST: APIRoute = async ({ request }) => {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { blog_post_id } = await request.json();

  if (!blog_post_id) {
    return new Response(JSON.stringify({ error: 'blog_post_id is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({
        published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', blog_post_id)
      .select('id, slug')
      .single();

    if (error) {
      console.error('Blog publish error:', error);
      return new Response(JSON.stringify({ error: 'Failed to publish blog', detail: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      id: data.id,
      slug: data.slug,
      url: `/blog/${data.slug}`,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Blog publish error:', err);
    return new Response(JSON.stringify({ error: 'Blog publish failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
