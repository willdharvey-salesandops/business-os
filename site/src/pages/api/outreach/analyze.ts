import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

const SYSTEM_PROMPT = `You are a business automation consultant analyzing small UK businesses. Your client (Leadership Growth Consulting) offers to build simple digital improvements for free as a way to start relationships with business owners.

Analyze the website and generate actionable ideas. Be specific to THIS business, not generic. The ideas should be things a developer could build in 1-2 days: chatbots, booking widgets, automated follow-ups, review collection systems, lead capture forms, process dashboards, reporting tools, client portals, etc.

Rules:
- Be hyper-specific to their business. Reference what you see on their site.
- Each idea should be a concrete tool or widget, not a vague "improve your SEO" suggestion.
- The email should feel genuinely helpful, not salesy. Mention one specific observation about their website.
- Never use em dashes in any copy.
- Keep the email to 60-100 words. Relationship-first tone.
- Respond with valid JSON only, no markdown formatting or code fences.`;

interface AnalysisResult {
  website_analysis: {
    overall_score: string;
    design_quality: string;
    lead_capture: string;
    contact_ease: string;
    mobile_friendly: string;
    key_observation: string;
  };
  improvement_ideas: Array<{
    title: string;
    description: string;
    impact: string;
  }>;
  draft_email: {
    subject: string;
    body: string;
  };
}

async function fetchWebsiteHTML(url: string): Promise<string> {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeadershipGrowthBot/1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return '';
    let html = await response.text();

    // Strip scripts, styles, and SVGs to reduce token count
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    // Take first 8000 characters
    return html.substring(0, 8000);
  } catch {
    return '';
  }
}

function extractEmailsFromHTML(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
  // Filter out common false positives
  return matches.filter(e =>
    !e.includes('example.com') &&
    !e.includes('wix.com') &&
    !e.includes('squarespace.com') &&
    !e.includes('wordpress.com') &&
    !e.includes('sentry.io')
  );
}

function guessOwnerEmail(ownerName: string, websiteUrl: string, foundEmails: string[]): string {
  // If we found emails on the website, prefer info@ or the first one
  if (foundEmails.length > 0) {
    const infoEmail = foundEmails.find(e => e.startsWith('info@') || e.startsWith('contact@') || e.startsWith('hello@'));
    if (infoEmail) return infoEmail;
    return foundEmails[0];
  }

  // Try to guess from owner name + domain
  if (ownerName && websiteUrl) {
    try {
      const domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace('www.', '');
      const nameParts = ownerName.toLowerCase().split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0]}@${domain}`;
      }
    } catch { /* ignore */ }
  }

  return '';
}

export const POST: APIRoute = async ({ request }) => {
  const { prospect_id } = await request.json();

  if (!prospect_id) {
    return new Response(JSON.stringify({ error: 'prospect_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();

  // Read prospect
  const { data: prospect, error: readError } = await supabase
    .from('outreach_prospects')
    .select('*')
    .eq('id', prospect_id)
    .single();

  if (readError || !prospect) {
    return new Response(JSON.stringify({ error: 'Prospect not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!prospect.website) {
    await supabase
      .from('outreach_prospects')
      .update({ pipeline_status: 'disqualified' })
      .eq('id', prospect_id);

    return new Response(JSON.stringify({
      prospect_id,
      status: 'disqualified',
      reason: 'No website URL available',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch and clean website HTML
    const websiteHTML = await fetchWebsiteHTML(prospect.website);

    if (!websiteHTML) {
      await supabase
        .from('outreach_prospects')
        .update({ pipeline_status: 'disqualified' })
        .eq('id', prospect_id);

      return new Response(JSON.stringify({
        prospect_id,
        status: 'disqualified',
        reason: 'Could not fetch website',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract emails from the website
    const foundEmails = extractEmailsFromHTML(websiteHTML);

    // Build SIC description
    const sicCodes = prospect.sic_codes || [];
    const sicDescription = sicCodes.length > 0 ? `SIC codes: ${sicCodes.join(', ')}` : 'Industry unknown';

    // Call Claude
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const userPrompt = `Company: ${prospect.company_name}
Industry: ${sicDescription}
Website: ${prospect.website}
Owner/Director: ${prospect.owner_name || 'Unknown'}
Location: ${prospect.address || 'UK'}
Google Rating: ${prospect.google_rating || 'N/A'}/5
Accounts type: ${prospect.accounts_type || 'Unknown'}

Website HTML (trimmed):
${websiteHTML}

Please return JSON with this exact structure:
{
  "website_analysis": {
    "overall_score": "1-10",
    "design_quality": "brief assessment",
    "lead_capture": "does the site capture leads? how?",
    "contact_ease": "how easy is it to contact them?",
    "mobile_friendly": "assessment",
    "key_observation": "one standout thing about this business"
  },
  "improvement_ideas": [
    {
      "title": "specific idea name",
      "description": "2-3 sentences explaining what we'd build and why it helps",
      "impact": "what this would do for their business"
    },
    {
      "title": "second idea",
      "description": "2-3 sentences",
      "impact": "business impact"
    },
    {
      "title": "third idea",
      "description": "2-3 sentences",
      "impact": "business impact"
    }
  ],
  "draft_email": {
    "subject": "short, personal subject line",
    "body": "cold email body (60-100 words, relationship-first tone, mention one specific observation about their business, offer the top idea as a free build, sign off as Will from Leadership Growth Consulting)"
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let responseText = (message.content[0] as { type: 'text'; text: string }).text.trim();
    // Strip markdown code fences if present
    const fenceMatch = responseText.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
    if (fenceMatch) {
      responseText = fenceMatch[1].trim();
    }

    const analysis: AnalysisResult = JSON.parse(responseText);

    // Determine owner email
    const ownerEmail = guessOwnerEmail(prospect.owner_name || '', prospect.website, foundEmails);

    // Update prospect
    await supabase
      .from('outreach_prospects')
      .update({
        website_analysis: analysis.website_analysis,
        improvement_ideas: analysis.improvement_ideas,
        draft_subject: analysis.draft_email.subject,
        draft_body: analysis.draft_email.body,
        owner_email: ownerEmail,
        pipeline_status: 'email_drafted',
      })
      .eq('id', prospect_id);

    return new Response(JSON.stringify({
      prospect_id,
      status: 'email_drafted',
      website_analysis: analysis.website_analysis,
      improvement_ideas: analysis.improvement_ideas,
      draft_email: analysis.draft_email,
      owner_email: ownerEmail,
      found_emails: foundEmails,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Analyze error:', err);
    return new Response(JSON.stringify({ error: 'Analysis failed', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
