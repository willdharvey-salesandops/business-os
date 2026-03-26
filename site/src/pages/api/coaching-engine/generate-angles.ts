import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { COACHING_VOICE_CONTEXT, COACHING_CLIENT_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a content angle generator for Will Harvey, a leadership coach who works with CEOs, founders, and business owners.

## WILL'S VOICE
${COACHING_VOICE_CONTEXT}

## WILL'S AUDIENCE
${COACHING_CLIENT_CONTEXT}

## YOUR TASK
Generate 2-3 content angles for Will's next piece of content. Each angle must be grounded in real coaching themes from recent client conversations. The angles should feel like something Will would naturally want to talk about, not something manufactured.

## ANGLE DESIGN RULES
- Each angle must connect to at least one real theme from the coaching sessions
- Include a mood suggestion: "raw" (personal, vulnerable), "teaching" (framework, clear takeaways), or "story" (narrative-led, one core story)
- The headline should be the kind of thing that makes someone stop scrolling
- Talking points should be specific enough to guide a 10-15 minute recording
- Vary the pillars across the 2-3 angles (do not give 3 leadership angles unless that is all the themes support)
- If a pillar has been underrepresented recently, lean into it

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "angles": [
    {
      "headline": "Scroll-stopping headline",
      "context": "2-3 sentences explaining why this angle matters right now, grounded in the coaching themes",
      "talking_points": ["Specific point 1", "Specific point 2", "Specific point 3", "Specific point 4"],
      "mood": "raw|teaching|story",
      "pillar": "leadership|personal|sales",
      "source_theme_ids": ["uuid1", "uuid2"]
    }
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

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    let themesContext = 'No themes in the bank yet. Generate angles based on common coaching challenges for CEOs and founders.';
    let pillarBalance = '';

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get recent themes (last 60 days), bias toward unused ones
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: themes } = await supabase
        .from('coaching_themes')
        .select('id, theme, pillar, context, source_date, times_used')
        .gte('source_date', sixtyDaysAgo)
        .order('times_used', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(30);

      if (themes && themes.length > 0) {
        themesContext = `Recent coaching themes (sorted by least used first):\n${themes.map(t =>
          `- [${t.id}] (${t.pillar}) "${t.theme}" - ${t.context} (used ${t.times_used}x)`
        ).join('\n')}`;
      }

      // Check pillar balance from recent sessions
      const { data: recentSessions } = await supabase
        .from('coaching_sessions')
        .select('selected_angle')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentSessions && recentSessions.length > 0) {
        const pillarCounts: Record<string, number> = { leadership: 0, personal: 0, sales: 0 };
        recentSessions.forEach(s => {
          const pillar = s.selected_angle?.pillar;
          if (pillar && pillarCounts[pillar] !== undefined) pillarCounts[pillar]++;
        });
        const leastUsed = Object.entries(pillarCounts).sort((a, b) => a[1] - b[1])[0];
        pillarBalance = `\nPillar balance from last 5 sessions: ${JSON.stringify(pillarCounts)}. The "${leastUsed[0]}" pillar is underrepresented, consider leaning into it.`;
      }
    }

    const body = await request.json().catch(() => ({}));
    const extraContext = body.context || '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate 2-3 content angles based on these coaching themes:\n\n${themesContext}${pillarBalance}${extraContext ? `\n\nAdditional context from Will: ${extraContext}` : ''}`,
      }],
    });

    const rawText = (message.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const data = JSON.parse(rawText.slice(start, end + 1));

    return new Response(JSON.stringify({ success: true, angles: data.angles || [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Angle generation error:', err);
    return new Response(JSON.stringify({ error: 'Angle generation failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
