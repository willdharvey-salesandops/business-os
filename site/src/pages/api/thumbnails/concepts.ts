import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

function getAnthropicApiKey(): string {
  return import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
}

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getAnthropicApiKey();
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { video_topic, video_title, num_concepts = 4 } = await request.json();

  if (!video_topic && !video_title) {
    return new Response(JSON.stringify({ error: 'video_topic or video_title is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a YouTube thumbnail strategist. Generate ${num_concepts} thumbnail concepts for this video:

Topic: ${video_topic || 'N/A'}
Title: ${video_title || 'N/A'}

For each concept, provide:
1. A detailed image generation prompt (for AI image generation, describing the full scene including a placeholder person)
2. Text overlay (2-4 words max that would appear on the thumbnail)
3. The mood/emotion it should evoke
4. Why this concept would get clicks
5. Suggested expressions for the person (excited, confident, thinking, pointing, surprised, professional)

The placeholder person description should include: medium build, clean appearance, squared to camera or slightly angled. Do NOT include specific identity details.

Return valid JSON only (no markdown fences):
{
  "concepts": [
    {
      "name": "Short concept name",
      "image_prompt": "Detailed prompt for AI image generation...",
      "text_overlay": "2-4 WORDS",
      "mood": "The emotion this triggers",
      "click_reason": "Why someone would click",
      "expressions": ["excited", "confident"]
    }
  ]
}`,
      }],
    });

    const rawText = (message.content[0] as any)?.text || '';
    const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify({
      success: true,
      ...parsed,
      video_topic,
      video_title,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Concept generation error:', err);
    return new Response(JSON.stringify({
      error: 'Thumbnail concept generation failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
