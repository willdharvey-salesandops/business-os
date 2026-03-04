import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

function getAnthropicApiKey(): string {
  const key = 'ANTHROPIC_API_KEY';
  return process.env[key] || import.meta.env[key] || '';
}

const SYSTEM_PROMPT = `You are a professional clerk who writes formal minutes for school governing body meetings in England. You convert raw meeting transcripts into clean, structured minutes that match the standard format used by school governors.

## YOUR TASK

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

## OUTPUT FORMAT

Return valid JSON with this exact structure:

{
  "title": "School Name",
  "meeting_type": "Minutes of the Interim Executive Board (IEB)" or "Minutes (Part A) of a Meeting of the Teaching, Learning & Community Committee" etc.,
  "date_line": "Thursday 12th February, 2026, 2pm-4pm in School",
  "quorum": "Meeting is Quorate" or "In Quorum",
  "attendees": [
    { "name": "Ian Hutchings (HT)", "role": "Headteacher" },
    { "name": "Angela Patel (Chair)", "role": "Vice Chair of Governors/TLC Chair" }
  ],
  "in_attendance": [
    { "name": "Jess Russ", "role": "Deputy Headteacher (DHT)" },
    { "name": "Alison Harvey", "role": "Clerk" }
  ],
  "apologies": ["Rosemary Hafeez - stepping down for now due to workload"],
  "items": [
    {
      "number": "1.",
      "title": "Welcome, Apologies for Absence and advance notice of AOB",
      "sub_items": [
        {
          "ref": "",
          "description": "Rosemary Hafeez stepping down for now due to workload.",
          "action": ""
        }
      ]
    },
    {
      "number": "2.",
      "title": "Declarations of business interests",
      "sub_items": [
        {
          "ref": "",
          "description": "None.",
          "action": ""
        }
      ]
    },
    {
      "number": "3.",
      "title": "Feedback: Updating Action Plan and next steps",
      "sub_sections": [
        {
          "ref": "3.1",
          "title": "Leadership & Governance",
          "sub_items": [
            {
              "ref": "a)",
              "description": "The columns on the action plan were discussed, whether these were all necessary.",
              "action": ""
            },
            {
              "ref": "b)",
              "description": "IEB Action Plan to be updated and moved to Governor Hub.",
              "action": "Rosemary"
            }
          ]
        },
        {
          "ref": "3.2",
          "title": "Curriculum & Standards",
          "sub_items": [
            {
              "ref": "a)",
              "description": "Cathy reported to the board about the school Monitoring Schedule.",
              "action": ""
            }
          ]
        }
      ]
    }
  ],
  "next_meeting": "13th March 2026 at School Premises 9:30am to 12:30pm",
  "standing_items": ["Action plan review including budget monitoring", "HT report including SDP and data", "Safeguarding report including H&S"],
  "actions_summary": [
    {
      "ref": "2c",
      "description": "Add SDP to Governor Hub.",
      "by_whom": "Clerk",
      "by_when": ""
    },
    {
      "ref": "3.1b",
      "description": "IEB Action Plan to be updated and moved to Governor Hub.",
      "by_whom": "Rosemary",
      "by_when": ""
    }
  ]
}

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
13. The output JSON must be valid. Escape special characters properly. Do not wrap in markdown code fences.
14. If attendee roles cannot be determined from the transcript, use "Governor" as the default role.
15. Capture financial figures, dates, and statistics precisely as stated.`;

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
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = (message.content[0] as any).text || '';
    const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const minutesData = JSON.parse(cleaned);

    return new Response(JSON.stringify({
      success: true,
      ...minutesData,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Minutes generation error:', err);

    if (err instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response. Please try again.' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Minutes generation failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
