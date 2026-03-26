import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { COACHING_VOICE_CONTEXT, COACHING_CLIENT_CONTEXT } from '../../../lib/business-context';

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

const SYSTEM_PROMPT = `You are the article writer for Will Harvey, a leadership coach who works with CEOs, founders, and business owners.

## WILL'S VOICE
${COACHING_VOICE_CONTEXT}

## WILL'S AUDIENCE
${COACHING_CLIENT_CONTEXT}

## BLOG WRITING RULES

### ICP Grounding
The reader is a business owner. Profitable but stretched. The business runs through them. Every paragraph must earn its place.

Write TO this person using scenarios they recognise:
- "You briefed your operations manager on Monday, checked in Thursday, and the work came back half-done."
- "Your best person just handed in their notice, and you realised they were the only one who knew how the process worked."
- "It is 9pm, you are closing the laptop, and another notification pulls you back in."

Say "business owner" or "owner", not "founder". Never explicitly call out team size.

### Anti-Slop Protocol
1. Specificity Test: At least 3 concrete scenarios the reader would recognise.
2. "So What?" Test: Every major point must include a practical action.
3. Owner Voice Test: Must sound like someone who has run a team.
4. Uniqueness Test: Say something the top Google results do NOT say.
5. No-Guru Test: No motivational poster sentences.

### Banned Phrases
"In today's fast-paced business environment", "It's no secret that...", "Studies show..." (without citation), "The key to success is...", "Take your business to the next level", "Game-changer", "Unlock", "Transform", "Empower", "At the end of the day", "It goes without saying"

### Content Grounding
Every article must reference at least one real coaching scenario or pattern from the transcript. This is what makes Will's content different: it comes from real conversations, not research.

### Structure
- 800-1500 words, scannable with clear H2 subheadings
- Open with the problem or a relatable story, not "In this article..."
- Short paragraphs (2-4 sentences max)
- End with a clear, natural next step (not a hard sell)
- Never use em dashes

### SEO Rules
- Title includes a natural search query
- H2 headings answer sub-questions a searcher would have
- FAQs match "People Also Ask" patterns
- Meta description includes the primary keyword, under 160 characters
- Categories: Leadership | Personal | Sales | Growth

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "title": "Article title",
  "slug": "url-friendly-slug",
  "category": "Leadership|Personal|Sales|Growth",
  "excerpt": "1-2 sentence summary for listings",
  "meta_description": "Under 160 chars for SEO",
  "meta_keywords": "comma, separated, keywords",
  "content": "Full markdown article content",
  "faqs": [
    {"question": "Q1?", "answer": "A1"},
    {"question": "Q2?", "answer": "A2"},
    {"question": "Q3?", "answer": "A3"}
  ]
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, topic, angle, publish_draft = true } = await request.json();
  if (!transcript) {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const angleContext = angle
      ? `\nContent angle: "${angle.headline}"\nMood: ${angle.mood}\nPillar: ${angle.pillar}\nTalking points: ${(angle.talking_points || []).join(', ')}`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Turn this coaching content transcript into a full blog article with SEO metadata.${angleContext}${topic ? `\nTopic focus: ${topic}` : ''}\n\nTRANSCRIPT:\n${transcript.slice(0, 10000)}`,
      }],
    });

    const rawText = (message.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const blog = JSON.parse(rawText.slice(start, end + 1));

    const wordCount = (blog.content || '').split(/\s+/).length;
    blog.read_time = `${Math.max(1, Math.ceil(wordCount / 230))} min read`;

    let blogPostId = null;
    if (publish_draft && supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: blogRow, error: blogErr } = await supabase
        .from('blog_posts')
        .insert({
          title: blog.title,
          slug: blog.slug || slugify(blog.title),
          content: blog.content,
          category: blog.category || 'Leadership',
          excerpt: blog.excerpt || '',
          meta_description: blog.meta_description || '',
          meta_keywords: blog.meta_keywords || '',
          author: 'Will Harvey',
          faqs: blog.faqs || [],
          read_time: blog.read_time,
          published: false,
        })
        .select('id')
        .single();

      if (blogErr) {
        console.error('Blog draft insert error:', blogErr);
      } else {
        blogPostId = blogRow?.id;
      }
    }

    return new Response(JSON.stringify({ success: true, blog, blog_post_id: blogPostId }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Blog generation error:', err);
    return new Response(JSON.stringify({ error: 'Blog generation failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
