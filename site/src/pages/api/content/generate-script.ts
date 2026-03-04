import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_CONTEXT, CLIENT_CONTEXT, COMPANY_CONTEXT, SCRIPT_TEMPLATE } from '../../../lib/business-context';

export const prerender = false;

function getAnthropicApiKey(): string {
  return import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    const text = segments.map((s: any) => s.text).join(' ');
    // Cap at ~3000 words to stay within prompt limits
    return text.split(' ').slice(0, 3000).join(' ');
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a YouTube content strategist adapting outlier video ideas for Will Harvey's channel.

## WILL'S VOICE
${VOICE_CONTEXT}

## WILL'S AUDIENCE
${CLIENT_CONTEXT}

## WILL'S BUSINESS
${COMPANY_CONTEXT}

## SCRIPT STRUCTURE
${SCRIPT_TEMPLATE}

## YOUR TASK
You will receive data about a YouTube video that significantly over-performed its channel's median views (an "outlier"). Your job is to:

1. Analyze WHY this video over-performed (the hook, title pattern, topic resonance)
2. Adapt the core topic angle for Will's voice and audience
3. Generate a complete script outline following the structure above
4. Suggest 3 title options that use working patterns from the original

## RULES
- The adapted script must sound like Will talking, not an AI writing
- Ground every point in client experience ("I was working with a founder who...")
- No hustle language, no guru positioning
- Never use em dashes
- Keep it practical and specific, not motivational
- The hook must make a founder with 3-20 employees lean in immediately

Return valid JSON only. No markdown fences.`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getAnthropicApiKey();
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { video_id, title, channel_name, description, outlier_score, view_count, median_views } = await request.json();

  if (!video_id || !title) {
    return new Response(JSON.stringify({ error: 'video_id and title are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch transcript
    const transcript = await fetchTranscript(video_id);

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const userPrompt = `OUTLIER VIDEO DATA:
- Title: "${title}"
- Creator: ${channel_name || 'Unknown'}
- Views: ${(view_count || 0).toLocaleString()} (${outlier_score}x the channel median of ${(median_views || 0).toLocaleString()})
- Description: ${description || 'N/A'}
${transcript ? `\nTRANSCRIPT (first ~3000 words):\n${transcript}` : '\n(Transcript not available, work from title and description only)'}

Generate the adapted script as JSON with this structure:
{
  "analysis": {
    "why_it_worked": "2-3 sentences on why this over-performed",
    "hook_breakdown": "What the original hook/title did that resonated",
    "title_pattern": "The format pattern the title uses"
  },
  "adapted_script": {
    "working_title": "Will's adapted title",
    "topic": "One line describing the core topic",
    "hook": ["bullet 1", "bullet 2"],
    "intro": ["bullet 1", "bullet 2", "bullet 3"],
    "point_1": { "name": "Point name", "core_idea": "One line", "bullets": ["sub-bullet 1", "sub-bullet 2", "sub-bullet 3"], "takeaway": "Single actionable takeaway" },
    "point_2": { "name": "Point name", "core_idea": "One line", "bullets": ["sub-bullet 1", "sub-bullet 2", "sub-bullet 3"], "takeaway": "Single actionable takeaway" },
    "point_3": { "name": "Point name", "core_idea": "One line", "bullets": ["sub-bullet 1", "sub-bullet 2", "sub-bullet 3"], "takeaway": "Single actionable takeaway" },
    "cta": ["bullet 1", "bullet 2"],
    "title_options": [
      { "title": "Option 1", "rationale": "Why it works" },
      { "title": "Option 2", "rationale": "Why it works" },
      { "title": "Option 3", "rationale": "Why it works" }
    ]
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = (message.content[0] as any).text || '';
    // Strip markdown fences if present
    const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const scriptData = JSON.parse(cleaned);

    return new Response(JSON.stringify({
      success: true,
      transcript_available: !!transcript,
      original: { video_id, title, channel_name, outlier_score, view_count, median_views },
      ...scriptData,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Script generation error:', err);
    return new Response(JSON.stringify({ error: 'Script generation failed', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
