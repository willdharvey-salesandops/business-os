import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a theme extraction engine for a leadership coach. You read transcripts from real coaching sessions with CEOs, founders, and business owners, and you extract the distinct themes, problems, breakthroughs, and tensions that came up.

## EXTRACTION RULES
- Extract 5-12 distinct themes from the transcript
- Each theme must be a specific, concrete problem or insight, not a vague category
- Tag each theme with a pillar: "leadership", "personal", or "sales"
  - leadership: managing teams, delegation, difficult conversations, hiring/firing, culture, stepping back, accountability, performance
  - personal: mental health, energy, burnout, being lost, breathwork, fitness, vulnerability, identity, relationships, self-doubt
  - sales: pipeline, revenue, closing, sales hires, commercial strategy, pricing, lead generation
- Classify each as: "recurring_problem", "breakthrough", or "tension"
  - recurring_problem: something the client keeps hitting, a pattern
  - breakthrough: a moment of clarity, a shift in thinking
  - tension: an unresolved pull between two things (e.g. wanting to step back but not trusting the team)
- Write themes in plain language. "Founder still approving every hire" not "Delegation challenges in recruitment processes"
- The context should be one sentence explaining what specifically came up

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "themes": [
    {
      "theme": "Short, specific theme label",
      "pillar": "leadership|personal|sales",
      "context": "One sentence explaining what came up",
      "type": "recurring_problem|breakthrough|tension"
    }
  ],
  "session_summary": "2-3 sentence summary of what the coaching session covered"
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

  const { transcript } = await request.json();
  if (!transcript || !transcript.trim()) {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract themes from this coaching session transcript:\n\n${transcript.slice(0, 15000)}`,
      }],
    });

    const rawText = (message.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const data = JSON.parse(rawText.slice(start, end + 1));

    const themes = data.themes || [];
    let savedCount = 0;

    if (supabaseUrl && supabaseKey && themes.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const rows = themes.map((t: any) => ({
        theme: t.theme,
        pillar: t.pillar,
        context: t.context,
        source_date: new Date().toISOString().split('T')[0],
        times_used: 0,
      }));

      const { data: inserted, error } = await supabase
        .from('coaching_themes')
        .insert(rows)
        .select('id');

      if (error) {
        console.error('Theme insert error:', error);
      } else {
        savedCount = inserted?.length || 0;
      }

      // Get total theme count
      const { count } = await supabase
        .from('coaching_themes')
        .select('*', { count: 'exact', head: true });

      return new Response(JSON.stringify({
        success: true,
        themes,
        session_summary: data.session_summary || '',
        saved_count: savedCount,
        total_themes: count || 0,
      }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      themes,
      session_summary: data.session_summary || '',
      saved_count: 0,
      total_themes: 0,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Theme extraction error:', err);
    return new Response(JSON.stringify({ error: 'Theme extraction failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
