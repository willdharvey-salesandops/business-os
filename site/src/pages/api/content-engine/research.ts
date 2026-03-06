import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { VOICE_CONTEXT, CLIENT_CONTEXT, COMPANY_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const SYSTEM_PROMPT = `You are a daily news research agent for Will Harvey, founder of Leadership Growth Consulting. Will is an executive coach who helps business owners and CEOs build businesses that run without them. AI is now the most powerful tool for making businesses more efficient and effective, so AI news is central to his content.

## WILL'S VOICE
${VOICE_CONTEXT}

## WILL'S AUDIENCE
${CLIENT_CONTEXT}

## WILL'S BUSINESS
${COMPANY_CONTEXT}

## YOUR TASK
Search for the most important news stories from the last 24 hours that are relevant to the intersection of AI and small business. Find 5-7 real, current news stories. For each story:

1. Write a clear, factual headline
2. Write 1-2 paragraphs of factual detail (what happened, who's involved, the numbers)
3. Write a "Your angle" section that frames it for Will's audience: small business owners with 3-20 employees. This section should be written in Will's voice, as if he's explaining why this matters to a business owner sitting across the table from him. Practical, grounded, no hype.

The first story should be the biggest/most impactful (mark it as the lead story). The last story should be a philosophical/closing thought that ties the day's themes together.

The framing is always: Will is an executive coach who helps owners/CEOs/senior people. AI happens to be the most powerful tool right now for making businesses more efficient and effective. He's not an AI guru, he's a business coach who uses AI.

Never use em dashes. Replace with commas, periods, colons, or restructure the sentence.

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "date": "Day DD Month YYYY",
  "topic": "AI & Small Business",
  "stories": [
    {
      "number": 1,
      "headline": "Story headline",
      "lead_tag": "LEAD STORY or null for non-lead stories",
      "detail": "1-2 paragraphs of factual detail",
      "your_angle": "2-3 paragraphs framing it for small business owners in Will's voice"
    }
  ],
  "closing": {
    "title": "Today's Takeaway",
    "text": "A closing philosophical thought tying the day's themes together, 1-2 paragraphs"
  }
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { topic } = await request.json();

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const today = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const searchTopic = topic || 'AI and small business';

    const userPrompt = `Today is ${today}. Search for the most important news from the last 24 hours about ${searchTopic}. Find real, current stories. Focus on:

- Major AI company announcements (OpenAI, Google, Anthropic, Meta, etc.)
- AI tools and products relevant to small businesses
- Real examples of small businesses using AI
- Industry shifts that affect how small companies operate
- Government policy or regulation affecting AI adoption

Find 5-7 stories and compile them into a daily briefing. Every story must be real and from the last 24-48 hours. Include specific names, numbers, and facts.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 5000,
      system: SYSTEM_PROMPT,
      tools: [{
        type: 'web_search_20250305' as any,
        name: 'web_search',
        max_uses: 5,
      }],
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text from multi-block response (web search returns multiple content blocks)
    let rawText = '';
    for (const block of message.content) {
      if ((block as any).type === 'text') {
        rawText += (block as any).text;
      }
    }

    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const briefing = JSON.parse(rawText.slice(start, end + 1));

    return new Response(JSON.stringify({ success: true, briefing }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Research briefing error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate briefing', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
