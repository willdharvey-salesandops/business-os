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

const SYSTEM_PROMPT = `You are a business automation consultant analyzing small UK businesses. Your client (Leadership Growth Consulting) builds simple digital improvements as a way to start relationships with business owners.

Analyze the website and generate actionable ideas. Be specific to THIS business, not generic. The ideas should be things a developer could build in 1-2 days: chatbots, booking widgets, automated follow-ups, review collection systems, lead capture forms, process dashboards, reporting tools, client portals, instant quote calculators, etc.

Rules for the ideas:
- Be hyper-specific to their business. Reference what you see on their site.
- Each idea should be a concrete tool or widget, not a vague "improve your SEO" suggestion.

Rules for the initial email (IMPORTANT - follow this structure closely):

1. OPEN with a specific, genuine observation about their business or website. Then immediately explain why it matters to them. Not just "I noticed X" but "I noticed X. That is a strong [trust signal / conversion opportunity / etc.] that is currently doing nothing to [get you more bookings / convert visitors / etc.]."

2. BRIDGE to value. Normalise the problem and make the fix feel easy: "A lot of companies think this takes a lot of effort to fix. But it can be really simple and adds a lot of value."

3. OFFER to build it for them. You MUST NOT use the word "free", "no cost", "complimentary", or "at no charge" anywhere in the email. These kill deliverability. Instead, simply offer to do it: "I can sort this out for you" or "I can get this built for you this week" or "I can put this together for you". The absence of any mention of payment implies it is offered freely without triggering spam filters.

4. LIST 2-3 concrete ideas as bullet points, drawn from your improvement_ideas. Use a short intro line like "I have also put together a few ideas for [company] that will save you time and bring in more enquiries. For example:" then bullet points with idea names.

5. OFFER to send ideas as a PDF: "I can send these over as a one-page breakdown if that is useful."

6. CLOSE with a soft question. "Would it be helpful to talk through this week?" or "Worth a quick look?"

Tone rules (apply to ALL emails):
- Calm, direct, confident. You have already done the work.
- Never say "I'd love", "I'd be thrilled", "I'm excited", "I hope this finds you well" or any over-eager language.
- Never use em dashes (—) anywhere. Use commas, periods, or colons instead.
- Format with \\n\\n between paragraphs. Do NOT write as one solid block.
- Sign off as Will, Leadership Growth Consulting (initial email) or just Will (follow-ups).
- Keep the initial email to 120-160 words.

You must generate THREE emails: the initial email, a follow-up for 2 days later, and a final follow-up for 5 days later.
- Follow-up 1 (day 2): Shorter (50-80 words). Add a small piece of value, a different angle, or reference a specific idea you could build for them. Do NOT repeat the initial email. Still end on a question.
- Follow-up 2 (day 5): Final nudge (30-50 words). Casual, no pressure. Leave the door open. Still end on a question.
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
  follow_up_1: {
    subject: string;
    body: string;
  };
  follow_up_2: {
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

interface EmailCandidate {
  email: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  verified: 'valid' | 'catch-all' | 'invalid' | 'unknown' | 'unchecked';
}

const GENERIC_PREFIXES = ['info', 'contact', 'hello', 'admin', 'office', 'enquiries', 'enquiry', 'sales', 'support', 'team', 'general', 'mail', 'reception'];

// Prospeo Email Finder: find the director's verified email from name + domain
async function prospeoFindEmail(firstName: string, lastName: string, domain: string, apiKey: string): Promise<{ email: string; status: string } | null> {
  try {
    const res = await fetch('https://api.prospeo.io/email-finder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        company: domain,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error('Prospeo finder error:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    if (data.error || !data.response?.email) return null;
    return {
      email: data.response.email,
      status: data.response.email_status || 'unknown',
    };
  } catch (err) {
    console.error('Prospeo finder failed:', err);
    return null;
  }
}

// Prospeo Email Verifier: check if a specific email address exists
async function prospeoVerifyEmail(email: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch('https://api.prospeo.io/email-verifier', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return 'unknown';
    const data = await res.json();
    const status = (data.response?.email_status || data.email_status || 'unknown').toLowerCase();
    if (status === 'valid') return 'valid';
    if (status === 'catch_all' || status === 'catch-all' || status === 'accept_all') return 'catch-all';
    if (status === 'invalid' || status === 'disposable') return 'invalid';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function mapProspeoStatus(status: string): EmailCandidate['verified'] {
  const s = status.toLowerCase();
  if (s === 'valid') return 'valid';
  if (s === 'catch_all' || s === 'catch-all' || s === 'accept_all') return 'catch-all';
  if (s === 'invalid' || s === 'disposable') return 'invalid';
  return 'unknown';
}

async function generateEmailCandidates(
  ownerName: string,
  websiteUrl: string,
  foundEmails: string[],
  prospeoKey: string,
): Promise<EmailCandidate[]> {
  const candidates: EmailCandidate[] = [];
  let domain = '';

  try {
    domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace('www.', '');
  } catch { /* ignore */ }

  if (!domain) return candidates;

  const nameParts = (ownerName || '').toLowerCase().trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length >= 2 ? nameParts[nameParts.length - 1] : '';
  const added = new Set<string>();

  // Step 1: Try Prospeo Email Finder (best source: verified email for this person)
  if (prospeoKey && firstName && lastName) {
    const found = await prospeoFindEmail(firstName, lastName, domain, prospeoKey);
    if (found && found.email) {
      const verified = mapProspeoStatus(found.status);
      if (verified !== 'invalid') {
        candidates.push({
          email: found.email,
          source: 'Prospeo (verified)',
          confidence: verified === 'valid' ? 'high' : 'medium',
          verified,
        });
        added.add(found.email.toLowerCase());
      }
    }
  }

  // Split found website emails into personal vs generic
  const personalWebEmails: string[] = [];
  const genericWebEmails: string[] = [];

  for (const email of foundEmails) {
    const prefix = email.split('@')[0].toLowerCase();
    if (GENERIC_PREFIXES.includes(prefix)) {
      genericWebEmails.push(email);
    } else {
      personalWebEmails.push(email);
    }
  }

  // Step 2: Personal email from website matching director name
  if (firstName) {
    const matching = personalWebEmails.filter(e => {
      const prefix = e.split('@')[0].toLowerCase();
      return prefix.includes(firstName) || (lastName && prefix.includes(lastName));
    });
    for (const e of matching) {
      if (!added.has(e.toLowerCase())) {
        candidates.push({ email: e, source: 'Website (matches director)', confidence: 'high', verified: 'unchecked' });
        added.add(e.toLowerCase());
      }
    }
  }

  // Step 3: Guessed personal patterns from owner name + domain
  if (firstName && domain) {
    const patterns = firstName && lastName
      ? [
          `${firstName}@${domain}`,
          `${firstName}.${lastName}@${domain}`,
          `${firstName[0]}${lastName}@${domain}`,
          `${firstName[0]}.${lastName}@${domain}`,
        ]
      : [`${firstName}@${domain}`];

    for (const p of patterns) {
      if (!added.has(p.toLowerCase())) {
        candidates.push({ email: p, source: 'Guessed from director name', confidence: 'low', verified: 'unchecked' });
        added.add(p.toLowerCase());
      }
    }
  }

  // Step 4: Other personal emails from website
  for (const e of personalWebEmails) {
    if (!added.has(e.toLowerCase())) {
      candidates.push({ email: e, source: 'Website (personal)', confidence: 'medium', verified: 'unchecked' });
      added.add(e.toLowerCase());
    }
  }

  // Step 5: Generic emails as last resort
  for (const e of genericWebEmails) {
    if (!added.has(e.toLowerCase())) {
      candidates.push({ email: e, source: 'Website (generic)', confidence: 'low', verified: 'unchecked' });
      added.add(e.toLowerCase());
    }
  }

  // Step 6: Verify unchecked candidates via Prospeo (top 3 only to conserve credits)
  if (prospeoKey) {
    const toVerify = candidates.filter(c => c.verified === 'unchecked').slice(0, 3);
    for (const candidate of toVerify) {
      const status = await prospeoVerifyEmail(candidate.email, prospeoKey);
      candidate.verified = status as EmailCandidate['verified'];
      if (status === 'valid') candidate.confidence = 'high';
      else if (status === 'invalid') candidate.confidence = 'low';
    }
  }

  // Sort: valid verified first, then catch-all, then unchecked, then invalid last
  const verifiedOrder: Record<string, number> = { valid: 0, 'catch-all': 1, unknown: 2, unchecked: 3, invalid: 4 };
  candidates.sort((a, b) => (verifiedOrder[a.verified] ?? 3) - (verifiedOrder[b.verified] ?? 3));

  // Remove any that came back invalid
  return candidates.filter(c => c.verified !== 'invalid');
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
    "subject": "short, personal subject line (no clickbait, no spam words)",
    "body": "Write 120-160 words following this structure exactly:\\n1. Open with specific observation + why it matters to THEM\\n2. Bridge: normalise the problem, make the fix feel easy\\n3. Offer to build it (DO NOT say free/no cost/complimentary)\\n4. List 2-3 concrete ideas as bullet points with a short intro\\n5. Offer to send as a PDF\\n6. Close with a soft question\\n\\nUse \\n\\n between paragraphs. Use \\n- for bullet points. Sign off as:\\n\\nWill\\nLeadership Growth Consulting"
  },
  "follow_up_1": {
    "subject": "Re: [same subject as initial email]",
    "body": "50-80 words. Add a specific piece of value or reference one idea you could build for them. Do NOT repeat the initial email. Still end on a question. Use \\n\\n between paragraphs. Sign off as:\\n\\nWill"
  },
  "follow_up_2": {
    "subject": "Re: [same subject as initial email]",
    "body": "30-50 words. Final nudge. Casual, no pressure. Leave the door open. Still end on a question. Use \\n\\n between paragraphs. Sign off as:\\n\\nWill"
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
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

    // Generate ranked email candidates with Prospeo verification where possible
    const prospeoKey = getEnv('PROSPEO_API_KEY');
    const emailCandidates = await generateEmailCandidates(prospect.owner_name || '', prospect.website, foundEmails, prospeoKey);
    const ownerEmail = emailCandidates.length > 0 ? emailCandidates[0].email : '';

    // Update prospect
    await supabase
      .from('outreach_prospects')
      .update({
        website_analysis: analysis.website_analysis,
        improvement_ideas: analysis.improvement_ideas,
        draft_subject: analysis.draft_email.subject,
        draft_body: analysis.draft_email.body,
        follow_up_1_subject: analysis.follow_up_1?.subject || '',
        follow_up_1_body: analysis.follow_up_1?.body || '',
        follow_up_2_subject: analysis.follow_up_2?.subject || '',
        follow_up_2_body: analysis.follow_up_2?.body || '',
        owner_email: ownerEmail,
        email_candidates: emailCandidates,
        pipeline_status: 'email_drafted',
      })
      .eq('id', prospect_id);

    return new Response(JSON.stringify({
      prospect_id,
      status: 'email_drafted',
      website_analysis: analysis.website_analysis,
      improvement_ideas: analysis.improvement_ideas,
      draft_email: analysis.draft_email,
      follow_up_1: analysis.follow_up_1,
      follow_up_2: analysis.follow_up_2,
      owner_email: ownerEmail,
      email_candidates: emailCandidates,
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
