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

const SYSTEM_PROMPT = `You are analyzing a UK business website to write a cold outreach email on behalf of Will, a Fractional Growth Partner who works inside businesses alongside their owners, building the systems, teams, and structure that lets them step back without things falling apart.

You are NOT a web developer offering site fixes. You are identifying where simple automated systems could save the business owner time, bring in more enquiries, or remove manual work.

## WEBSITE ANALYSIS RULES

1. READ THE FULL CONTENT CAREFULLY. List what IS on the site before identifying what is absent. Always.
2. NEVER claim something is missing unless you are certain it is not in the content. If you cannot confirm something is absent, say "I could not find X in the content provided" not "X is missing." If unsure, flag uncertainty. Never state an unverified observation as fact.
3. For every site, explicitly confirm or deny the presence of each:
   - Reviews/testimonials (exact count and star rating, e.g. "28 Google reviews, 5.0 stars displayed on homepage with full review text"). If a reviews widget exists, state the exact plugin name, rating, and review count.
   - Lead magnets (including exit popups, downloadable resources, free consultation offers, PDF guides)
   - Client portals or login areas
   - Newsletter signups (check both body and footer of every page)
   - Booking/scheduling tools or contact forms
   - Interactive tools (calculators, estimators, quote generators)
   - Webinar or events sections
   - Blog/news (list the 3-5 most recent post TITLES and dates. If stale, over 12 months, note as context but never reference negatively in the email)
   - Technology partnerships or certifications (e.g. Xero, QuickBooks, Sage)
   - Service lines and sector lists (list ALL sector names verbatim for bullet personalisation)
   - Service promises and commitments (response times, turnaround guarantees, free consultations, fixed fees, unlimited support offers). These are HIGH-PRIORITY hooks because they are manual commitments that automations can help deliver consistently.
   - Footer content: check for newsletter signup forms, social links, accreditation logos, contact details
   NOTE: Exit popups and dynamically loaded widgets may not appear in the content provided. If you see references to popup scripts or modal elements but cannot confirm the content, note this limitation.
4. Be deeply specific. "28 five-star Google reviews displayed on homepage via Business Reviews Bundle widget with full review text" not "good reviews."
5. When the firm has existing digital tools, client portals, email programmes, or proprietary systems, flag as an existing digital signal. Reference as a compliment in the email and position automations as complementary, not remedial.
6. REVIEW MINING: When client reviews are visible, extract:
   - Recurring themes and language (what clients consistently praise)
   - Specific team members mentioned by name and what they are praised for
   - Emotional language revealing what clients value most
   If reviews consistently praise a specific team member whose role overlaps with suggested automations, frame automations as freeing that person for higher-value work, never replacing them. Use exact review language as personalisation material.
7. GOOGLE RATING VERIFICATION: A Google Maps rating is provided in the prompt. You MUST separately verify whether this rating appears ON the website itself (via a widget, badge, or text). State clearly: "X.X stars from Y reviews displayed on the website via [widget name]" OR "Google rating not displayed on the website, only exists externally." NEVER reference a star rating in the email or improvement ideas unless you have confirmed it is displayed on the website. Round DOWN, never up. 4.9 is 4.9, not 5.0.
8. ABOUT PAGE DEPTH: The About page often contains the richest personalisation material. Thoroughly parse for: founding story and year, team member names with roles, service promises and guarantees (fixed fees, response times, unlimited support), sector lists, certifications, accreditations, partner bios with career backgrounds, and any email programmes or content mentioned ("FREE Tax Tips", newsletters, guides). If the About page was provided, every relevant detail must appear in the assessment.
9. When visible typos or errors exist on the site, note in the assessment as context but NEVER reference them in the email.

## FRANCHISE AND STRUCTURE RECOGNITION
- Recognise franchise structures (AIMS, TaxAssist, Crunch, etc.). Flag that the prospect does not control their own website. Shift the angle entirely to operational automations that help the individual practitioner. Never reference website elements the prospect cannot personally change.
- For franchise operators, use the INDIVIDUAL practitioner's personal story for personalisation: their career background, years of experience, specialisms, geographic coverage, and client reviews mentioning them by name. Generic franchise content is not personalisation.
- When the URL/domain does not match the firm's trading name, flag this prominently in the assessment as a RISK.
- When multiple contacts share the same surname, flag as a likely family-run business.

## FOUR EMAIL ANGLES (choose the right one, do NOT default to Angle 2)

Angle 1 - SOMETHING IS VISIBLY BROKEN
Use when: You find a VERIFIABLE error you are CERTAIN about (broken widget showing wrong data, misconfigured element, dead form).
CRITICAL: If the assessment says "could not confirm" whether something renders, you MUST NOT use Angle 1. Switch to Angle 3 or 4.

Angle 2 - CLEAR GAP IN A DECENT SETUP
Use when: Site is functional but you can VERIFY a specific conversion element is missing.
CRITICAL: You must be certain the gap exists. If in any doubt, use Angle 3 or 4.

Angle 3 - GOOD SETUP, LEAD WITH IDEAS
Use when: Site does most things well, you cannot confidently identify gaps.
Tone: Complimentary then suggestive. "Your site does a lot right. Here is what I build for firms like yours."

Angle 4 - LEAD WITH THE BUSINESS
Use when: You find a compelling business event, growth signal, founder story, unique positioning, service promise, or niche specialisation.
Tone: Personal and specific. Engage with the business itself, not the website.
Examples: Recent acquisition, capacity constraints, niche positioning, founder philosophy, service commitments like "24-hour response guarantee."
Lowest risk because you are engaging with what they care about most.

## EMAIL STRUCTURE (initial email, 120-160 words)

GREETING: "Hi [first name],\\n\\n" using the contact name provided. This is MANDATORY. If no name is available, use "Hi there,\\n\\n" and flag in the assessment that no verified name was found.

OPENING (1-2 sentences): Lead directly with the hook. Keep it tight. The first sentence must BE the observation, compliment, or business insight. Earn the right to make the observations that follow. When addressed to a specific person, personalisation must match THAT person's story, not just the firm's founding narrative. Shorter is better here, get to the bridge quickly.

BRIDGE (1 sentence): Reframe or reassurance transitioning to the offer. Position with speed and scale, not systems and manual work. "I work with [type of firm owner] to make their operations run at a speed that keeps up with their ambition, without adding headcount." The reader should feel the size of what is possible.

IDEAS (1 paragraph + bullets): Introduce with "I had three ideas for things we could build to free up time:" then 3 bullet points. Bullets are short, one line each. Every bullet must end with what disappears from the person's plate or what becomes instant that was previously slow. Frame as outcome-led, not feature-led. Wrong: "An automated reporting deadline reminder sequence triggered per client." Right: "A deadline system that means no client is ever chased manually again, the reminders run themselves." When the firm lists specific sectors, mirror those sector names in the bullets. When the blog has specific post topics, name them in the nurture bullet rather than referencing "your blog" generically.

OFFER (2 sentences): Lead with the build, not the one-pager. "If any of the above sounds useful, I will build one of them for you. No cost, no catch, it is yours to keep. It is how I introduce the way I work, and it will be working in your business the moment you get it."

CTA (1 line): "Worth me sharing some more details?"

SIGN-OFF: "Will" (no company name on any email).

## SUBJECT LINE RULES
- 2-4 words maximum.
- Use the prospect's own language or business events where possible.
- Often a noun or concept, not a full sentence.
- No company name unless possessive makes it personal (e.g. "Greentree's pricing gap").
- Create curiosity without being clickbaity.
- NEVER use subject lines that sound diagnostic or negative (e.g. "30 years, one problem"). The subject line must not undercut a carefully observational email body.
- NEVER use subject lines that could be mistaken for spam or phishing (e.g. "Paying too much tax", "Save money now"). Financial or tax-related claims in subject lines trigger spam filters and suspicion.
- Safe patterns: firm name + "systems", a service promise back to them ("Same-day, every time"), a niche reference, the practitioner's name if personal.
- When in doubt, go shorter and safer.

## TONE RULES (apply to ALL emails)
- OBSERVATIONAL, not diagnostic. Never tell a prospect what their problem is. Share observations, not diagnoses.
- Use softening language: "could," "can," "I have seen," "tends to," "might."
- Ground claims in experience: "I have seen from working with similar firms that..."
- Frame as possibility, not certainty.
- When you cannot verify something is missing, talk about what COULD be built rather than what IS wrong.
- NEVER say: "doing nothing to convert," "the issue is," "prospects have no reason to feel confident," "leaving a lot on the table," "that is the first thing they will notice."
- NEVER say: "I'd love," "I'd be thrilled," "I'm excited," "I hope this finds you well," "I can sort this out for you," "I can get that built for you this week."
- Never use em dashes anywhere. Use commas, periods, or colons.

## BANNED OPENERS
NEVER open with any variation of:
- "I came across [firm] while looking at..."
- "I was looking at [type] in [area]..."
- "I noticed your..."
- "I found your..."
- Any reference to how you discovered the prospect (search results, directories, old URLs, franchise pages).
The first sentence after the greeting must BE the hook itself: a tagline, a business observation, a compliment, or a specific insight. Nobody cares how you found them.

## FORMATTING RULES
- Use \\n\\n between paragraphs.
- Use \\n- for bullet points under "Things like:" only.
- Everything else in flowing prose, not bullets.
- No bold, no italics, plain text only.
- Short paragraphs.

## DEEP PERSONALISATION (sources in order of impact)
1. Their own words from their site (philosophy, tagline, mission statement, service promises, founding story)
2. Service commitments that map to automation opportunities ("24-hour response time" becomes "what if a system could do that in seconds", "same-day response guarantee" becomes "a bold promise to put on the homepage")
3. Business events (acquisitions, awards, growth, capacity constraints, recent hires with dates, new partners joining)
4. Their target audience named specifically ("a SaaS founder and a landlord land on the same homepage")
5. Specific numbers from their site (exact review counts verified on-site, years in business, number of services, team size, partner count)
6. Client review language and themes: extract exact phrases from reviews, name team members praised, reflect their clients' words back. "Your clients call Dan 'patient and thorough'" is better than "you have good reviews."
7. Existing digital tools or programmes (client portals, email newsletters, proprietary systems, review widgets, reference as a compliment and build on what exists)
8. Team details and individual bios: match personalisation to the RECIPIENT's specific background, career history, and specialisms. If emailing a practice manager, reference practice operations. If emailing a partner, reference growth and client relationships.
9. Specific blog post titles and topics: name the actual posts in nurture bullets. "Your salary sacrifice article" not "your blog content." "Posts on school fees VAT and ecommerce accounting" not "content from the Resources section."
10. Sector names verbatim: if the firm lists "Manufacturing, Construction, Property, IT" as sectors, mirror those exact names in qualifying/routing automation bullets.

## IMPROVEMENT IDEAS
- Every idea must be framed as a system or automation, not a website feature.
- Every idea must be outcome-led: end with what disappears from the person's plate or what becomes instant that was previously slow.
- Wrong: "An automated MTD and FCA reporting deadline reminder sequence triggered per client." Right: "A deadline system that means no client is ever chased manually again, the reminders run themselves, per client, without the team touching it."
- Wrong: "An enquiry routing system that qualifies and directs inbound contacts by geography and service line." Right: "A system that means every enquiry is qualified and routed before [name] even sees it, no manual triage across four service lines."
- Wrong: "A small addition to the existing site." Right: "An automated review request system that keeps your 5-star rating growing without anyone chasing it."
- Be hyper-specific to THIS business, referencing what you found on their site.
- When the firm already has an email programme or content, position automations as enhancing what they started, not replacing it.
- For franchise operators, focus entirely on operational automations that help the individual practitioner, not website observations.

## FOLLOW-UPS
Follow-up 1 (day 3, 50-80 words): Must open with "Hi [first name],\\n\\n". Add a specific piece of value or reference one idea you could build. Different angle from the initial email. End on a question. Sign off "Will."
Follow-up 2 (day 6, 40-60 words): Must open with "Hi [first name],\\n\\n". Plant a seed about what happens after the free build. Hint at the larger engagement without selling it. Frame the free build as a gateway experience: "the business owners I work with tend to start with one small system and then realise how much else could operate the same way." Leave the door open. End on a question. Sign off "Will."

## QUALITY CHECKLIST (verify every point before output)
- Does every email start with "Hi [first name]," greeting?
- Has every claim about what is "missing" been verified against the content provided?
- Is the tone observational rather than diagnostic?
- Are all ideas framed as systems/automations, not website features?
- Is the subject line 2-4 words, safe (not diagnostic, not spammy), and intriguing?
- Zero em dashes in all emails?
- Does the opening lead with the hook, not "I came across" or how you found them?
- Ideas listed as bullets under "I had three ideas..." intro, everything else prose?
- CTA is "Worth me sharing some more details?"
- "No cost, no catch, it is yours to keep" line included?
- Offer leads with the build ("I will build one of them for you"), not the one-pager?
- Every bullet idea ends with what disappears or what becomes instant?
- Positioning line leads with speed and scale, not systems and manual work?
- Correct angle chosen (not defaulting to Angle 2)?
- If Angle 1 or 2, is the claim verifiably true from the content?
- Deep personalisation beyond firm name and location?
- Opening earns the right to make the observations that follow?
- Google rating ONLY referenced if verified as displayed ON the website?
- Personalisation matches the RECIPIENT, not just the firm?
- Service promises from the About page captured and used as hooks?
- Specific blog post titles used in nurture bullets (not generic "your blog")?
- Sector names mirrored verbatim from the site?
- Client review themes and team member mentions extracted?
- For franchise operators, personalisation uses the individual's story, not the brand?

Respond with valid JSON only, no markdown formatting or code fences.`;

interface AnalysisResult {
  website_analysis: {
    recommended_angle: number;
    angle_rationale: string;
    verified_elements: string[];
    missing_elements: string[];
    overall_score: string;
    design_quality: string;
    lead_capture: string;
    contact_ease: string;
    key_observation: string;
    growth_signals: string;
    service_promises: string;
    existing_digital_signals: string;
    franchise_flag: string;
    contact_name_verified: string;
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

  const [homepage, about1, about2, team1, team2, services, reviews, blog] = await Promise.all([
    fetchPageHTML(fullUrl, 25000),
    fetchPageHTML(`${baseUrl}/about`, 15000),
    fetchPageHTML(`${baseUrl}/about-us`, 15000),
    fetchPageHTML(`${baseUrl}/team`, 10000),
    fetchPageHTML(`${baseUrl}/our-team`, 10000),
    fetchPageHTML(`${baseUrl}/services`, 10000),
    fetchPageHTML(`${baseUrl}/reviews`, 8000),
    fetchPageHTML(`${baseUrl}/blog`, 5000),
  ]);

  let content = homepage;
  const aboutPage = about1 || about2;
  if (aboutPage) content += `\n\n--- ABOUT PAGE ---\n\n${aboutPage}`;
  const teamPage = team1 || team2;
  if (teamPage) content += `\n\n--- TEAM PAGE ---\n\n${teamPage}`;
  if (services) content += `\n\n--- SERVICES PAGE ---\n\n${services}`;
  if (reviews) content += `\n\n--- REVIEWS PAGE ---\n\n${reviews}`;
  if (blog) content += `\n\n--- BLOG PAGE ---\n\n${blog}`;
  return content;
}

// Prospeo Enrich: get verified email from person_id or name+domain
async function prospeoEnrich(
  params: { personId: string } | { firstName: string; lastName: string; domain: string },
  apiKey: string,
): Promise<{ email: string; status: string; title: string; fullName: string } | null> {
  try {
    let data: Record<string, string>;
    if ('personId' in params) {
      data = { person_id: params.personId };
    } else {
      data = {
        first_name: params.firstName,
        last_name: params.lastName,
        company_website: params.domain,
      };
    }

    const res = await fetch('https://api.prospeo.io/enrich-person', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': apiKey,
      },
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;
    const result = await res.json();
    if (result.error || !result.person?.email?.email) return null;

    return {
      email: result.person.email.email,
      status: result.person.email.status || 'unknown',
      title: result.person.current_job_title || '',
      fullName: result.person.full_name || '',
    };
  } catch {
    return null;
  }
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

  const { data: prospect, error: readError } = await supabase
    .from('campaign_prospects')
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
      .from('campaign_prospects')
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
    // Step 1: Enrich via Prospeo to get verified email
    const prospeoKey = getEnv('PROSPEO_API_KEY');
    let contactEmail = prospect.email || '';
    let contactName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim();
    let contactTitle = prospect.title || '';
    let prospeoNote = '';

    if (!contactEmail && prospeoKey) {
      // Try enriching with stored person_id first
      if (prospect.prospeo_person_id) {
        const enriched = await prospeoEnrich({ personId: prospect.prospeo_person_id }, prospeoKey);
        if (enriched && enriched.email) {
          contactEmail = enriched.email;
          contactTitle = enriched.title || contactTitle;
          const status = enriched.status?.toLowerCase();
          if (status === 'invalid' || status === 'disposable') {
            // Invalid email, skip this prospect
            await supabase
              .from('campaign_prospects')
              .update({
                pipeline_status: 'disqualified',
                prospeo_verification: status,
              })
              .eq('id', prospect_id);

            return new Response(JSON.stringify({
              prospect_id,
              status: 'disqualified',
              reason: `Invalid email (${status})`,
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          prospeoNote = `Enriched via person_id: ${contactEmail} (${enriched.status})`;

          // Update email in DB
          await supabase
            .from('campaign_prospects')
            .update({
              email: contactEmail,
              prospeo_verification: enriched.status,
            })
            .eq('id', prospect_id);
        } else {
          prospeoNote = 'Enrich by person_id: no email found';
        }
      }

      // Fallback: try name + domain
      if (!contactEmail && prospect.first_name && prospect.last_name) {
        let domain = '';
        try {
          domain = new URL(prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`).hostname.replace('www.', '');
        } catch { /* ignore */ }

        if (domain) {
          const enriched = await prospeoEnrich({
            firstName: prospect.first_name.toLowerCase(),
            lastName: prospect.last_name.toLowerCase(),
            domain,
          }, prospeoKey);

          if (enriched && enriched.email) {
            const status = enriched.status?.toLowerCase();
            if (status === 'invalid' || status === 'disposable') {
              await supabase
                .from('campaign_prospects')
                .update({
                  pipeline_status: 'disqualified',
                  prospeo_verification: status,
                })
                .eq('id', prospect_id);

              return new Response(JSON.stringify({
                prospect_id,
                status: 'disqualified',
                reason: `Invalid email (${status})`,
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              });
            }

            contactEmail = enriched.email;
            prospeoNote = `Enriched via name+domain: ${contactEmail} (${enriched.status})`;

            await supabase
              .from('campaign_prospects')
              .update({
                email: contactEmail,
                prospeo_verification: enriched.status,
              })
              .eq('id', prospect_id);
          } else {
            prospeoNote += '. Name+domain enrich: no email found';
          }
        }
      }
    }

    if (!contactEmail) {
      await supabase
        .from('campaign_prospects')
        .update({
          pipeline_status: 'disqualified',
          website_analysis: { prospeo_note: prospeoNote || 'No email found' },
        })
        .eq('id', prospect_id);

      return new Response(JSON.stringify({
        prospect_id,
        status: 'disqualified',
        reason: 'Could not find verified email',
        prospeo_note: prospeoNote,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch website content
    const websiteHTML = await fetchSiteContent(prospect.website);

    if (!websiteHTML) {
      await supabase
        .from('campaign_prospects')
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

    // Step 3: Call Claude
    const contactFirstName = contactName.split(/\s+/)[0] || '';
    const sicCodes = prospect.sic_codes || [];
    const sicDescription = sicCodes.length > 0 ? `SIC codes: ${sicCodes.join(', ')}` : 'Industry unknown';

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const contactLine = contactName
      ? `${contactName}${contactTitle ? ` (${contactTitle})` : ''}`
      : 'Unknown';

    const userPrompt = `Company: ${prospect.company_name}
Industry: ${sicDescription}
Website: ${prospect.website}
Contact person for email: ${contactLine}
Contact first name for greeting: ${contactFirstName || 'NONE - use "Hi there" and flag in assessment'}
Location: ${prospect.location || 'UK'}
Google Rating from Google Maps: N/A
Accounts type: ${prospect.accounts_type || 'Unknown'}

Website content (homepage + about/team pages if found):
${websiteHTML}

INSTRUCTIONS:
1. Read ALL website content above thoroughly. For every element in the assessment checklist (reviews, lead magnets, portals, newsletters, blog, sectors, service promises, tech partnerships, team), explicitly confirm or deny its presence.
2. Check if the firm operates within a franchise. Check if the URL matches the trading name.
3. Note service promises and commitments that map to automation opportunities.
4. Choose the best email angle (1-4) based on verified findings. If you cannot verify a gap, do NOT use Angle 1 or 2.
5. Write the email addressed to ${contactFirstName || 'the director'}. The greeting, opening, and personalisation must be specific to this person where possible.

Return JSON with this exact structure:
{
  "website_analysis": {
    "recommended_angle": 1-4,
    "angle_rationale": "why this angle was chosen, referencing specific verified evidence",
    "verified_elements": ["list every element confirmed on the site"],
    "missing_elements": ["elements checked but not found"],
    "overall_score": "1-10",
    "design_quality": "brief assessment",
    "lead_capture": "what lead capture exists",
    "contact_ease": "how easy to contact them",
    "key_observation": "the single most compelling thing about this business",
    "growth_signals": "growth indicators, awards, news",
    "service_promises": "specific commitments that map to automation hooks",
    "existing_digital_signals": "client portals, email programmes, proprietary tools",
    "franchise_flag": "is this a franchise operation?",
    "contact_name_verified": "was the contact name found on the website?"
  },
  "improvement_ideas": [
    {
      "title": "specific automation/system name",
      "description": "2-3 sentences. Frame as a system that runs without human input.",
      "impact": "time saved, manual work removed"
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
    "subject": "2-4 words only.",
    "body": "Start with 'Hi ${contactFirstName || 'there'},\\n\\n' then 120-160 words. Structure: Opening (1-2 sentences) -> Bridge (speed/scale positioning) -> Ideas ('I had three ideas...' + 3 outcome-led bullets) -> Offer (lead with the build) -> CTA -> Sign off 'Will'. Use \\n\\n between paragraphs. Use \\n- for bullets."
  },
  "follow_up_1": {
    "subject": "Re: [same subject]",
    "body": "Start with 'Hi ${contactFirstName || 'there'},\\n\\n' then 50-80 words. Different angle. End on a question. Sign off 'Will'."
  },
  "follow_up_2": {
    "subject": "Re: [same subject]",
    "body": "Start with 'Hi ${contactFirstName || 'there'},\\n\\n' then 30-50 words. Final nudge. Sign off 'Will'."
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let responseText = (message.content[0] as { type: 'text'; text: string }).text.trim();
    const fenceMatch = responseText.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
    if (fenceMatch) {
      responseText = fenceMatch[1].trim();
    }

    const analysis: AnalysisResult = JSON.parse(responseText);

    const websiteAnalysis = {
      ...analysis.website_analysis,
      prospeo_note: prospeoNote,
    };

    await supabase
      .from('campaign_prospects')
      .update({
        website_analysis: websiteAnalysis,
        improvement_ideas: analysis.improvement_ideas,
        draft_subject: analysis.draft_email.subject,
        draft_body: analysis.draft_email.body,
        follow_up_1_subject: analysis.follow_up_1?.subject || '',
        follow_up_1_body: analysis.follow_up_1?.body || '',
        follow_up_2_subject: analysis.follow_up_2?.subject || '',
        follow_up_2_body: analysis.follow_up_2?.body || '',
        pipeline_status: 'analyzed',
      })
      .eq('id', prospect_id);

    return new Response(JSON.stringify({
      prospect_id,
      status: 'analyzed',
      website_analysis: websiteAnalysis,
      improvement_ideas: analysis.improvement_ideas,
      draft_email: analysis.draft_email,
      follow_up_1: analysis.follow_up_1,
      follow_up_2: analysis.follow_up_2,
      contact_name: contactName,
      contact_email: contactEmail,
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
