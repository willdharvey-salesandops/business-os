import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

function getAnthropicApiKey(): string {
  const key = 'ANTHROPIC_API_KEY';
  return process.env[key] || import.meta.env[key] || '';
}

const SYSTEM_PROMPT = `You are a professional clerk who writes formal minutes for school governing body meetings in England. You convert raw meeting transcripts into clean, structured minutes that match the standard format used by school governors.

Read the transcript carefully and produce formal meeting minutes. Identify:
- The school name and meeting type (IEB, TLC Committee, FGB, etc.)
- Date, time, and location
- All attendees with their roles (Headteacher, Chair, Co-Opted Governor, Parent Governor, Staff Governor, Associate Member, etc.)
- People "In Attendance" who are not governors (Clerk, Deputy Head, etc.)
- Whether the meeting was quorate
- Each agenda item or topic discussed
- Decisions made and policies ratified
- Action items: who needs to do what, and by when if mentioned
- Date of next meeting

## RULES

1. Never use em dashes. Use commas, colons, periods, or restructure sentences instead.
2. Clean up speech artifacts: remove "um", "uh", false starts, repetitions, and filler words.
3. Use initials in brackets after names when first introduced, e.g. "Rosemary Hafeez (RH)". Use these initials or first names consistently thereafter.
4. Write in third person formal style: "Members discussed...", "HT advised...", "Governors asked...". Never use first person.
5. Be concise but complete. Capture every decision, policy ratification, and action item. Summarise discussions without repeating every word.
6. If something is unclear in the transcript, write "[unclear]" rather than guessing.
7. Number agenda items sequentially (1, 2, 3...). Use decimal sub-numbering (3.1, 3.2, 3.3) for major topic areas. Use lettered sub-points (a, b, c) within each section.
8. Group related discussion under the same agenda item. Do not create separate items for continuations of the same topic.
9. Always include the actions_summary array, even if empty.
10. Preserve exact names of documents, reports, policies, and organisations referenced.
11. If votes are taken, record the outcome: "Approved unanimously" or "Approved (X for, Y against, Z abstentions)".
12. Record policy ratifications explicitly: "The [Policy Name] was approved by Governors."
13. If attendee roles cannot be determined from the transcript, use "Governor" as the default role.
14. Capture financial figures, dates, and statistics precisely as stated.

Call the submit_minutes tool with the structured minutes data.`;

const MINUTES_TOOL: Anthropic.Tool = {
  name: 'submit_minutes',
  description: 'Submit the structured meeting minutes extracted from the transcript.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'School name' },
      meeting_type: { type: 'string', description: 'e.g. "Minutes of the Interim Executive Board (IEB)"' },
      date_line: { type: 'string', description: 'e.g. "Thursday 12th February, 2026, 2pm-4pm in School"' },
      quorum: { type: 'string', description: 'e.g. "Meeting is Quorate"' },
      attendees: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, role: { type: 'string' } },
          required: ['name', 'role'],
        },
      },
      in_attendance: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, role: { type: 'string' } },
          required: ['name', 'role'],
        },
      },
      apologies: { type: 'array', items: { type: 'string' } },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            number: { type: 'string' },
            title: { type: 'string' },
            sub_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: { ref: { type: 'string' }, description: { type: 'string' }, action: { type: 'string' } },
                required: ['ref', 'description'],
              },
            },
            sub_sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ref: { type: 'string' },
                  title: { type: 'string' },
                  sub_items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { ref: { type: 'string' }, description: { type: 'string' }, action: { type: 'string' } },
                      required: ['ref', 'description'],
                    },
                  },
                },
                required: ['ref', 'title'],
              },
            },
          },
          required: ['number', 'title'],
        },
      },
      next_meeting: { type: 'string' },
      standing_items: { type: 'array', items: { type: 'string' } },
      actions_summary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string' },
            description: { type: 'string' },
            by_whom: { type: 'string' },
            by_when: { type: 'string' },
          },
          required: ['ref', 'description', 'by_whom'],
        },
      },
    },
    required: ['title', 'meeting_type', 'date_line', 'attendees', 'items', 'actions_summary'],
  },
};

export const POST: APIRoute = async ({ request }) => {
  const anthropicKey = getAnthropicApiKey();
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { transcript, title, school_name, date, meeting_type } = body;

  if (!transcript || typeof transcript !== 'string') {
    return new Response(JSON.stringify({ error: 'Transcript is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (transcript.length < 100) {
    return new Response(JSON.stringify({ error: 'Transcript is too short. Please provide a more complete transcript.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cap transcript length
  const trimmedTranscript = transcript.length > 100000
    ? transcript.substring(0, 100000) + '\n\n[Transcript truncated at 100,000 characters]'
    : transcript;

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    let userPrompt = 'MEETING TRANSCRIPT:\n\n';
    if (school_name) userPrompt += `School: ${school_name}\n`;
    if (meeting_type) userPrompt += `Meeting type: ${meeting_type}\n`;
    if (title) userPrompt += `Meeting title: ${title}\n`;
    if (date) userPrompt += `Meeting date: ${date}\n`;
    if (school_name || meeting_type || title || date) userPrompt += '\n';
    userPrompt += trimmedTranscript;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [MINUTES_TOOL],
      tool_choice: { type: 'tool', name: 'submit_minutes' },
    });

    // Find the tool_use block - guaranteed by tool_choice
    const toolBlock = message.content.find((b: any) => b.type === 'tool_use') as any;
    if (!toolBlock || !toolBlock.input) {
      return new Response(JSON.stringify({ error: 'AI did not return structured minutes. Please try again.' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const minutesData = toolBlock.input;

    return new Response(JSON.stringify({
      success: true,
      ...minutesData,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Minutes generation error:', err);

    return new Response(JSON.stringify({
      error: 'Minutes generation failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
