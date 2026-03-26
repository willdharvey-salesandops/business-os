import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { COACHING_VOICE_CONTEXT, COACHING_CLIENT_CONTEXT } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const MOOD_INSTRUCTIONS: Record<string, string> = {
  raw: `## MOOD: RAW / VULNERABLE
This is a personal one. Will is sharing something real, not teaching from a podium.

Structure:
- Open with honesty. No hook formula. Just say the thing.
- Share what actually happened or what you are actually feeling
- Let the messiness show. Do not tie it up neatly.
- If there is a lesson, let it emerge naturally, do not force a framework onto it
- Close with a question or an honest admission, not a neat bow

The viewer should feel like they caught Will being real, not performing. Permission to go off-script. The outline is a guide, not a cage.`,

  teaching: `## MOOD: TEACHING / FRAMEWORK
Will has a clear point to make and practical steps to share. Earned authority.

Structure:
1. Hook (0:00-0:10): Strong promise or pattern interrupt. The viewer knows exactly what they are getting.
2. Credibility (0:10-1:00): Who this is for, brief context from the coaching work.
3. Point 1: Name it clearly. Core idea in one line. Example or story. One actionable takeaway.
4. Point 2: Same structure.
5. Point 3: Same structure.
6. Close: Brief, warm. One clear next step. No hard sell.

Always exactly 3 talking points. Target: 10-15 minutes.`,

  story: `## MOOD: STORYTELLING
One core story that carries the lesson. The insight lives inside the narrative.

Structure:
- Setup: Who, where, what was happening. Make the person real (anonymised).
- Tension: What went wrong, what they were struggling with, the moment things got stuck.
- Turn: What shifted. The conversation, the realisation, the decision.
- Reflection: What this means for the viewer. The lesson without lecturing.
- Close: Land it with a question or observation that sits with them.

The story does the teaching. Do not break out of the narrative to explain the point. Trust the viewer.`,
};

const SYSTEM_PROMPT = `You are a script/outline creator for Will Harvey, a leadership coach who creates content from real coaching conversations.

## WILL'S VOICE
${COACHING_VOICE_CONTEXT}

## WILL'S AUDIENCE
${COACHING_CLIENT_CONTEXT}

## YOUR TASK
Take Will's rough first-thought recording (transcribed) and the chosen content angle, and create a structured script/outline for the final recording.

This is NOT a word-for-word teleprompter script. It is a structured guide that Will can glance at while recording naturally. Include:
- Key phrases and transitions to hit
- Stories or examples to include (from the rough recording)
- Emotional beats (where to slow down, where to be direct)
- The opening hook and closing

## SCRIPT RULES
- Never use em dashes. Replace with commas, periods, colons, or restructure.
- Keep language conversational. Write how Will talks, not how a copywriter writes.
- Include "[STORY:]" markers where Will should tell a specific story from the rough recording
- Include "[BEAT:]" markers for emotional moments (pause, slow down, get real)
- The hook must work in the first 5 seconds without context

## OUTPUT FORMAT
Return valid JSON only (no markdown fences):
{
  "title": "Working title for this piece",
  "mood": "raw|teaching|story",
  "estimated_duration": "12-15 minutes",
  "hook": "The opening 10 seconds, word for word",
  "sections": [
    {
      "heading": "Section name",
      "key_points": ["Point to hit", "Another point"],
      "story_prompt": "[STORY:] Tell the story about the founder who...",
      "emotional_beat": "[BEAT:] This is where you slow down and get personal",
      "transition": "How to move to the next section"
    }
  ],
  "closing": "How to land the ending",
  "notes": "Any reminders, callbacks, or things to weave in"
}`;

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { rough_transcript, angle, mood = 'teaching' } = await request.json();
  if (!rough_transcript || !rough_transcript.trim()) {
    return new Response(JSON.stringify({ error: 'rough_transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const moodInstructions = MOOD_INSTRUCTIONS[mood] || MOOD_INSTRUCTIONS.teaching;

    const userPrompt = `${moodInstructions}

## CHOSEN ANGLE
${angle ? `Headline: ${angle.headline}\nContext: ${angle.context}\nTalking points: ${(angle.talking_points || []).join(', ')}\nMood: ${angle.mood || mood}\nPillar: ${angle.pillar || 'leadership'}` : 'No specific angle chosen. Create a script from what Will talked about.'}

## WILL'S ROUGH RECORDING (transcribed)
This is Will talking through his thoughts. Extract the best material, stories, and insights, then structure them into a proper script.

${rough_transcript.slice(0, 12000)}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 5000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = (message.content[0] as any).text || '';
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found in response');
    const script = JSON.parse(rawText.slice(start, end + 1));

    return new Response(JSON.stringify({ success: true, script }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Script creation error:', err);
    return new Response(JSON.stringify({ error: 'Script creation failed', detail: err?.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
