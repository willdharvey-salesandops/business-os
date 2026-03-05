import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { VOICE_CONTEXT, CLIENT_CONTEXT, COMPANY_CONTEXT, SCRIPT_TEMPLATE } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const SYSTEM_PROMPT = `You are a content engine for Will Harvey's brand, Leadership Growth Consulting. You take a raw content idea and produce TWO outputs:

1. A BLOG ARTICLE (800-1200 words) ready for publishing
2. A VIDEO SCRIPT outline Will can use to film a talking-head YouTube video

## WILL'S VOICE
${VOICE_CONTEXT}

## WILL'S AUDIENCE
${CLIENT_CONTEXT}

## WILL'S BUSINESS
${COMPANY_CONTEXT}

## VIDEO SCRIPT STRUCTURE
${SCRIPT_TEMPLATE}

## BLOG WRITING RULES
- 800-1200 words, scannable with clear subheadings
- Open with the problem or a relatable story, not "In this article..."
- Practical, specific advice grounded in founder experience
- End with a clear next step (book a call, link in bio)
- Never use em dashes
- Include 2 FAQ items at the end

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "blog": {
    "title": "Blog article title",
    "slug": "url-friendly-slug",
    "category": "Leadership|Growth|Systems|AI",
    "excerpt": "1-2 sentence summary for listings",
    "meta_description": "Under 160 chars for SEO",
    "meta_keywords": "comma, separated, keywords",
    "content": "Full markdown article content",
    "faqs": [
      {"question": "Q1?", "answer": "A1"},
      {"question": "Q2?", "answer": "A2"}
    ]
  },
  "video_script": {
    "working_title": "Video title",
    "topic": "One-line topic summary",
    "hook": ["hook bullet 1", "hook bullet 2"],
    "intro": ["intro bullet 1", "intro bullet 2"],
    "point_1": {"name": "...", "core_idea": "...", "bullets": ["..."], "takeaway": "..."},
    "point_2": {"name": "...", "core_idea": "...", "bullets": ["..."], "takeaway": "..."},
    "point_3": {"name": "...", "core_idea": "...", "bullets": ["..."], "takeaway": "..."},
    "cta": ["cta bullet 1"],
    "title_options": [
      {"title": "Option 1", "rationale": "Why"},
      {"title": "Option 2", "rationale": "Why"},
      {"title": "Option 3", "rationale": "Why"}
    ]
  }
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Missing API keys' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { idea_id, title, notes, source } = await request.json();

  if (!idea_id || !title) {
    return new Response(JSON.stringify({ error: 'idea_id and title are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const userPrompt = `CONTENT IDEA:
Title: "${title}"
${notes ? `Notes/context: ${notes}` : ''}
${source ? `Source: ${source}` : ''}

Generate both a blog article and video script based on this idea. Make them complementary but not identical. The blog should be more detailed and SEO-friendly. The video script should be conversational and structured for filming.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = (message.content[0] as any).text || '';
    // Extract JSON object: find first { and last }
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('No JSON found in response');
    }
    const data = JSON.parse(rawText.slice(start, end + 1));

    const blog = data.blog;
    const videoScript = data.video_script;

    // Calculate read time
    const wordCount = (blog.content || '').split(/\s+/).length;
    const readTime = `${Math.max(1, Math.ceil(wordCount / 230))} min read`;

    // Insert blog post as unpublished draft
    const { data: blogRow, error: blogErr } = await supabase
      .from('blog_posts')
      .insert({
        title: blog.title,
        slug: blog.slug || slugify(blog.title),
        content: blog.content,
        category: blog.category || 'General',
        excerpt: blog.excerpt || '',
        meta_description: blog.meta_description || '',
        meta_keywords: blog.meta_keywords || '',
        author: 'Will Harvey',
        faqs: blog.faqs || [],
        read_time: readTime,
        published: false,
      })
      .select('id,title,slug')
      .single();

    if (blogErr) {
      console.error('Blog insert error:', blogErr);
    }

    // Insert video script
    const { data: scriptRow, error: scriptErr } = await supabase
      .from('video_scripts')
      .insert({
        idea_id,
        title: videoScript.working_title || title,
        topic: videoScript.topic || '',
        script_data: videoScript,
        status: 'draft',
      })
      .select('id,title')
      .single();

    if (scriptErr) {
      console.error('Video script insert error:', scriptErr);
    }

    // Update idea status to scripted (removes from idea bank)
    await supabase
      .from('content_ideas')
      .update({ status: 'scripted' })
      .eq('id', idea_id);

    return new Response(JSON.stringify({
      success: true,
      blog: blogRow ? { id: blogRow.id, title: blogRow.title, slug: blogRow.slug } : null,
      blog_error: blogErr?.message || null,
      video_script: scriptRow ? { id: scriptRow.id, title: scriptRow.title } : null,
      script_error: scriptErr?.message || null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Script idea error:', err);
    return new Response(JSON.stringify({ error: 'Generation failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
