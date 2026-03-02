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

const SYSTEM_PROMPT = `You are analyzing a UK business website to write a cold outreach email on behalf of Will, a Fractional Growth Partner who builds automated systems for small businesses.

You are NOT a web developer offering site fixes. You are identifying where simple automated systems could save the business owner time, bring in more enquiries, or remove manual work.

## WEBSITE ANALYSIS RULES

1. READ THE FULL CONTENT CAREFULLY. List what IS on the site before identifying gaps.
2. NEVER claim something is missing unless you are certain. If you cannot confirm something is absent, say "I could not find X in the content provided" not "X is missing." If unsure, flag uncertainty.
3. Look for and note:
   - Reviews, testimonials, ratings (exact numbers: "56 five-star Google reviews")
   - Awards, accreditations, badges
   - Blog posts, news, recent announcements
   - Team pages, founder stories, company values and philosophy
   - Target audience and niche positioning
   - Growth signals: recruiting, acquisitions, new offices, expansion
   - Capacity indicators: waiting lists, closed registrations, busy periods
   - Broken elements: widgets showing wrong data, dead links, misconfigured embeds
   - Their own language, taglines, and specific phrases worth reflecting back
4. Be deeply specific. "56 five-star reviews on Google, but the widget is showing 0 stars" not "good reviews."

## FOUR EMAIL ANGLES (choose the right one, do NOT default to Angle 2)

Angle 1 - SOMETHING IS VISIBLY BROKEN
Use when: You find a verifiable error (broken widget, misconfigured element, dead form).
Tone: Direct but helpful. Lowest risk if the error is real, highest risk if you get it wrong.

Angle 2 - CLEAR GAP IN A DECENT SETUP
Use when: Site is functional but you can VERIFY a specific conversion element is missing.
Tone: Observation-based. "One thing I could not find was..."
CRITICAL: You must be certain the gap exists. If in any doubt, use Angle 3 or 4.

Angle 3 - GOOD SETUP, LEAD WITH IDEAS
Use when: Site does most things well, you cannot confidently identify gaps.
Tone: Complimentary then suggestive. "Your site does a lot right. Here is what I build for firms like yours."

Angle 4 - LEAD WITH THE BUSINESS
Use when: You find a compelling business event, growth signal, founder story, or unique positioning.
Tone: Personal and specific. Engage with the business itself, not the website.
Examples: Recent acquisition, capacity constraints, niche positioning, founder philosophy.
Lowest risk because you are engaging with what they care about most.

## EMAIL STRUCTURE (initial email, 120-160 words)

OPENING (2-3 sentences): Specific observation or credit showing you have actually looked at the business. This earns the right to make the observations that follow.

BRIDGE (1 sentence): Reframe or reassurance transitioning to the offer. "I work with [type of firm] to build small systems that [outcome]."

IDEAS (1 paragraph + bullets): Introduce with "Things like:" then 3 bullet points. Bullets are short, one line each, starting with a concrete noun or action. Frame every idea as a system or automation that runs without human input. Emphasise saving time, removing manual work, working in the background, operating without someone being available.

OFFER (2 sentences): "I have put together a few ideas in a one-page breakdown, no cost, no catch, it is how I introduce the way I work." Then: "And if any of it is of interest, I will build an automation into your business without cost to show you how much time it could save."

CTA (1 line): "Worth me sharing some more details?"

SIGN-OFF: "Will" (no company name on any email).

## SUBJECT LINE RULES
- 2-4 words maximum.
- Use the prospect's own language or business events where possible.
- Often a noun or concept, not a full sentence.
- No company name unless possessive makes it personal (e.g. "Greentree's pricing gap").
- Create curiosity without being clickbaity.
- When in doubt, go shorter.

## TONE RULES (apply to ALL emails)
- OBSERVATIONAL, not diagnostic. Never tell a prospect what their problem is. Share observations, not diagnoses.
- Use softening language: "could," "can," "I have seen," "tends to," "might."
- Ground claims in experience: "I have seen from working with similar firms that..."
- Frame as possibility, not certainty.
- When you cannot verify something is missing, talk about what COULD be built rather than what IS wrong.
- NEVER say: "doing nothing to convert," "the issue is," "prospects have no reason to feel confident," "leaving a lot on the table," "that is the first thing they will notice."
- NEVER say: "I'd love," "I'd be thrilled," "I'm excited," "I hope this finds you well," "I can sort this out for you," "I can get that built for you this week."
- Never use em dashes anywhere. Use commas, periods, or colons.

## FORMATTING RULES
- Use \\n\\n between paragraphs.
- Use \\n- for bullet points under "Things like:" only.
- Everything else in flowing prose, not bullets.
- No bold, no italics, plain text only.
- Short paragraphs.

## DEEP PERSONALISATION (sources in order of impact)
1. Their own words from their site (philosophy, tagline, mission statement)
2. Business events (acquisitions, awards, growth, capacity constraints)
3. Their target audience named specifically ("a SaaS founder and a landlord land on the same homepage")
4. Specific numbers from their site (review counts, years in business, service count)
5. Broken or misconfigured elements
6. Their values or philosophy
7. Team details

## IMPROVEMENT IDEAS
- Every idea must be framed as a system or automation, not a website feature.
- Wrong: "A small addition to the existing site." Right: "An automated review request system that keeps your 5-star rating growing without anyone chasing it."
- Wrong: "Surfacing this properly." Right: "A system that works without anyone needing to be available."
- Be hyper-specific to THIS business, referencing what you found on their site.

## FOLLOW-UPS
Follow-up 1 (day 2, 50-80 words): Add a specific piece of value or reference one idea you could build. Different angle from the initial email. End on a question. Sign off "Will."
Follow-up 2 (day 5, 30-50 words): Final nudge. Casual, no pressure. Leave the door open. End on a question. Sign off "Will."

## QUALITY CHECKLIST (verify every point before output)
- Has every claim about what is "missing" been verified against the content provided?
- Is the tone observational rather than diagnostic?
- Are all ideas framed as systems/automations, not website features?
- Is the subject line 2-4 words?
- Zero em dashes in all emails?
- Ideas listed as bullets under "Things like:" only, everything else prose?
- CTA is "Worth me sharing some more details?"
- "No cost, no catch" line included?
- Automation build offer included?
- Correct angle chosen (not defaulting to Angle 2)?
- Deep personalisation beyond firm name and location?
- Opening earns the right to make the observations that follow?

Respond with valid JSON only, no markdown formatting or code fences.`;

interface AnalysisResult {
  website_analysis: {
    recommended_angle: number;
    angle_rationale: string;
    verified_elements: string[];
    overall_score: string;
    design_quality: string;
    lead_capture: string;
    contact_ease: string;
    key_observation: string;
    growth_signals: string;
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

async function fetchPageHTML(url: string, maxChars: number): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadershipGrowthBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return '';
    let html = await response.text();
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
    html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
    return html.substring(0, maxChars);
  } catch {
    return '';
  }
}

async function fetchSiteContent(websiteUrl: string): Promise<string> {
  const fullUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
  const baseUrl = fullUrl.replace(/\/$/, '');

  // Fetch homepage and about/team pages in parallel for richer context
  const [homepage, about1, about2, team] = await Promise.all([
    fetchPageHTML(fullUrl, 20000),
    fetchPageHTML(`${baseUrl}/about`, 10000),
    fetchPageHTML(`${baseUrl}/about-us`, 10000),
    fetchPageHTML(`${baseUrl}/team`, 5000),
  ]);

  let content = homepage;
  const aboutPage = about1 || about2;
  if (aboutPage) content += `\n\n--- ABOUT PAGE ---\n\n${aboutPage}`;
  if (team) content += `\n\n--- TEAM PAGE ---\n\n${team}`;
  return content;
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

// Prospeo Enrich Person: find the director's verified email from name + company domain
async function prospeoEnrichPerson(firstName: string, lastName: string, domain: string, apiKey: string): Promise<{ email: string; status: string } | null> {
  try {
    const res = await fetch('https://api.prospeo.io/enrich-person', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': apiKey,
      },
      body: JSON.stringify({
        data: {
          first_name: firstName,
          last_name: lastName,
          company_website: domain,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error('Prospeo enrich error:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    if (data.error || !data.person?.email?.email) return null;
    return {
      email: data.person.email.email,
      status: data.person.email.status || 'unknown',
    };
  } catch (err) {
    console.error('Prospeo enrich failed:', err);
    return null;
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
): Promise<{ candidates: EmailCandidate[]; prospeoNote: string }> {
  const candidates: EmailCandidate[] = [];
  let prospeoNote = '';
  let domain = '';

  try {
    domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace('www.', '');
  } catch { /* ignore */ }

  if (!domain) return { candidates, prospeoNote: 'Prospeo: skipped (no domain)' };

  const nameParts = (ownerName || '').toLowerCase().trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length >= 2 ? nameParts[nameParts.length - 1] : '';
  const added = new Set<string>();

  // Step 1: Try Prospeo Enrich Person (best source: verified email for this person)
  if (prospeoKey && firstName && lastName) {
    const found = await prospeoEnrichPerson(firstName, lastName, domain, prospeoKey);
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
        prospeoNote = `Prospeo: found ${found.email} (${verified})`;
      } else {
        prospeoNote = 'Prospeo: email found but marked invalid';
      }
    } else {
      prospeoNote = `Prospeo: no match for ${firstName} ${lastName} at ${domain}`;
    }
  } else if (!prospeoKey) {
    prospeoNote = 'Prospeo: skipped (no API key)';
  } else {
    prospeoNote = 'Prospeo: skipped (no director name)';
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

  // Sort: valid verified first, then catch-all, then unchecked, then invalid last
  const verifiedOrder: Record<string, number> = { valid: 0, 'catch-all': 1, unknown: 2, unchecked: 3, invalid: 4 };
  candidates.sort((a, b) => (verifiedOrder[a.verified] ?? 3) - (verifiedOrder[b.verified] ?? 3));

  // Remove any that came back invalid
  return { candidates: candidates.filter(c => c.verified !== 'invalid'), prospeoNote };
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
    // Fetch homepage + about/team pages for richer context
    const websiteHTML = await fetchSiteContent(prospect.website);

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

    // Extract emails from all fetched pages
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

Website content (homepage + about page if found):
${websiteHTML}

INSTRUCTIONS:
1. First, carefully read ALL the website content above. Note everything you can verify: reviews, testimonials, awards, team info, founder stories, niche positioning, growth signals, values, specific numbers.
2. Choose the best email angle (1-4) based on what you found.
3. Write the email using deep personalisation from the content.

Return JSON with this exact structure:
{
  "website_analysis": {
    "recommended_angle": 1-4,
    "angle_rationale": "why this angle was chosen",
    "verified_elements": ["list", "of", "things", "confirmed", "on", "the", "site"],
    "overall_score": "1-10",
    "design_quality": "brief assessment",
    "lead_capture": "what lead capture exists (verified)",
    "contact_ease": "how easy to contact them (verified)",
    "key_observation": "the single most compelling thing about this business for personalisation",
    "growth_signals": "any growth indicators, awards, news, acquisitions, hiring, capacity notes"
  },
  "improvement_ideas": [
    {
      "title": "specific automation/system name",
      "description": "2-3 sentences. Frame as a system that runs without human input.",
      "impact": "time saved, manual work removed, enquiries generated"
    },
    {
      "title": "second automation/system",
      "description": "2-3 sentences framed as automation",
      "impact": "business impact"
    },
    {
      "title": "third automation/system",
      "description": "2-3 sentences framed as automation",
      "impact": "business impact"
    }
  ],
  "draft_email": {
    "subject": "2-4 words only. Curiosity without clickbait.",
    "body": "120-160 words. Follow the structure: Opening (2-3 sentences, specific observation with softening language) -> Bridge (1 sentence, transition to offer) -> Ideas ('Things like:' + 3 bullet points as automations) -> Offer ('no cost, no catch' + automation build offer) -> CTA ('Worth me sharing some more details?') -> Sign off 'Will'. Use \\n\\n between paragraphs. Use \\n- for bullets."
  },
  "follow_up_1": {
    "subject": "Re: [same subject]",
    "body": "50-80 words. Different angle, reference a specific idea. End on a question. \\n\\n between paragraphs. Sign off 'Will'."
  },
  "follow_up_2": {
    "subject": "Re: [same subject]",
    "body": "30-50 words. Final nudge, casual, no pressure. End on a question. \\n\\n between paragraphs. Sign off 'Will'."
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
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
    const { candidates: emailCandidates, prospeoNote } = await generateEmailCandidates(prospect.owner_name || '', prospect.website, foundEmails, prospeoKey);
    const ownerEmail = emailCandidates.length > 0 ? emailCandidates[0].email : '';

    // Store prospeo note in website_analysis for persistence
    const websiteAnalysis = { ...analysis.website_analysis, prospeo_note: prospeoNote };

    // Update prospect
    await supabase
      .from('outreach_prospects')
      .update({
        website_analysis: websiteAnalysis,
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
      website_analysis: websiteAnalysis,
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
