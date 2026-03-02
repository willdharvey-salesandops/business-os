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
- When the URL/domain does not match the firm's trading name, flag this prominently in the assessment as a RISK. The email domain being used may belong to a different or defunct entity. State: "URL [x] does not match trading name [y]. Email to this domain may not reach the intended firm."
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

OPENING (2-3 sentences): Lead directly with the hook. The first sentence must BE the observation, compliment, or business insight. Earn the right to make the observations that follow. When addressed to a specific person, personalisation must match THAT person's story, not just the firm's founding narrative.

BRIDGE (1 sentence): Reframe or reassurance transitioning to the offer. "I work with [type of firm] to build small systems that [outcome]."

IDEAS (1 paragraph + bullets): Introduce with "Things like:" then 3 bullet points. Bullets are short, one line each, starting with a concrete noun or action. Frame every idea as a system or automation that runs without human input. When the firm lists specific sectors, mirror those sector names in the bullets. When the blog has specific post topics, name them in the nurture bullet rather than referencing "your blog" generically. When the firm segments by revenue tier, mirror their segmentation in qualifying/routing automation bullets.

OFFER (2 sentences): "I have put together a few ideas in a one-page breakdown, no cost, no catch, it is how I introduce the way I work." Then: "And if any of it is of interest, I will build an automation into your business without cost to show you how much time it could save."

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
- Wrong: "A small addition to the existing site." Right: "An automated review request system that keeps your 5-star rating growing without anyone chasing it."
- Wrong: "Surfacing this properly." Right: "A system that works without anyone needing to be available."
- Be hyper-specific to THIS business, referencing what you found on their site.
- When the firm already has an email programme or content, position automations as enhancing what they started, not replacing it.
- For franchise operators, focus entirely on operational automations that help the individual practitioner, not website observations.

## FOLLOW-UPS
Follow-up 1 (day 2, 50-80 words): Must open with "Hi [first name],\\n\\n". Add a specific piece of value or reference one idea you could build. Different angle from the initial email. End on a question. Sign off "Will."
Follow-up 2 (day 5, 30-50 words): Must open with "Hi [first name],\\n\\n". Final nudge. Casual, no pressure. Leave the door open. End on a question. Sign off "Will."

## QUALITY CHECKLIST (verify every point before output)
- Does every email start with "Hi [first name]," greeting?
- Has every claim about what is "missing" been verified against the content provided?
- Is the tone observational rather than diagnostic?
- Are all ideas framed as systems/automations, not website features?
- Is the subject line 2-4 words, safe (not diagnostic, not spammy), and intriguing?
- Zero em dashes in all emails?
- Does the opening lead with the hook, not "I came across" or how you found them?
- Ideas listed as bullets under "Things like:" only, everything else prose?
- CTA is "Worth me sharing some more details?"
- "No cost, no catch" line included?
- Automation build offer included?
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

  // Fetch homepage and key subpages in parallel for comprehensive context
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
  name?: string;
  title?: string;
}

interface ProspeoEnrichResult {
  email: string;
  status: string;
  title: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface ProspeoSearchResult {
  personId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  seniority: string;
  companyName: string;
  companyDomain: string;
}

const GENERIC_PREFIXES = ['info', 'contact', 'hello', 'admin', 'office', 'enquiries', 'enquiry', 'sales', 'support', 'team', 'general', 'mail', 'reception'];

// Prospeo Enrich Person: accepts name+domain OR person_id from search results
async function prospeoEnrich(
  params: { firstName: string; lastName: string; domain: string } | { personId: string },
  apiKey: string,
): Promise<ProspeoEnrichResult | null> {
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
    if (!res.ok) {
      console.error('Prospeo enrich error:', res.status, await res.text());
      return null;
    }
    const result = await res.json();
    if (result.error || !result.person?.email?.email) return null;
    return {
      email: result.person.email.email,
      status: result.person.email.status || 'unknown',
      title: result.person.current_job_title || '',
      firstName: result.person.first_name || '',
      lastName: result.person.last_name || '',
      fullName: result.person.full_name || '',
    };
  } catch (err) {
    console.error('Prospeo enrich failed:', err);
    return null;
  }
}

// Prospeo Search Person: find senior people at a company
// Searches by company name AND domain with multiple fallback strategies
async function prospeoSearchPerson(domain: string, companyName: string, apiKey: string): Promise<ProspeoSearchResult[]> {
  const attempts: string[] = [];

  async function doSearch(filters: Record<string, any>, label: string): Promise<ProspeoSearchResult[]> {
    try {
      const res = await fetch('https://api.prospeo.io/search-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': apiKey,
        },
        body: JSON.stringify({ page: 1, filters }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Prospeo search [${label}] error:`, res.status, errText);
        attempts.push(`${label}: HTTP ${res.status}`);
        return [];
      }

      const data = await res.json();
      if (data.error) {
        console.error(`Prospeo search [${label}] API error:`, data.error);
        attempts.push(`${label}: API error`);
        return [];
      }
      if (!data.results?.length) {
        attempts.push(`${label}: 0 results`);
        return [];
      }

      const mapped = data.results
        .map((r: any) => ({
          personId: r.person?.person_id || '',
          firstName: r.person?.first_name || '',
          lastName: r.person?.last_name || '',
          fullName: r.person?.full_name || `${r.person?.first_name || ''} ${r.person?.last_name || ''}`.trim(),
          title: r.person?.current_job_title || '',
          seniority: r.person?.job_history?.[0]?.seniority || '',
          companyName: r.company?.name || r.person?.job_history?.[0]?.company_name || '',
          companyDomain: r.company?.domain || '',
        }))
        .filter((p: ProspeoSearchResult) => p.personId);

      attempts.push(`${label}: ${mapped.length} people`);
      return mapped;
    } catch (err) {
      console.error(`Prospeo search [${label}] failed:`, err);
      attempts.push(`${label}: network error`);
      return [];
    }
  }

  const seniorityFilter = ['Founder/Owner', 'C-Suite', 'Partner', 'Vice President', 'Head', 'Director', 'Manager'];

  // Attempt 1: Senior people by company name (most reliable for small firms)
  if (companyName) {
    // Try full company name
    let results = await doSearch({
      company: { names: { include: [companyName] } },
      person_seniority: { include: seniorityFilter },
    }, `name:"${companyName}" +senior`);
    if (results.length > 0) return results;

    // Try shortened company name (strip Ltd, LLP, Limited, etc.)
    const shortName = companyName
      .replace(/\b(ltd|llp|limited|plc|inc|co|company|group|uk|services|consulting|associates)\b/gi, '')
      .replace(/[&,.\-()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (shortName && shortName !== companyName && shortName.length > 2) {
      results = await doSearch({
        company: { names: { include: [shortName] } },
        person_seniority: { include: seniorityFilter },
      }, `name:"${shortName}" +senior`);
      if (results.length > 0) return results;
    }
  }

  // Attempt 2: Senior people by domain
  let results = await doSearch({
    company: { websites: { include: [domain] } },
    person_seniority: { include: seniorityFilter },
  }, `domain:${domain} +senior`);
  if (results.length > 0) return results;

  // Attempt 3: Any person by domain (no seniority filter)
  results = await doSearch({
    company: { websites: { include: [domain] } },
  }, `domain:${domain} any`);
  if (results.length > 0) return results;

  // Attempt 4: Any person by company name (no seniority filter)
  if (companyName) {
    results = await doSearch({
      company: { names: { include: [companyName] } },
    }, `name:"${companyName}" any`);
    if (results.length > 0) return results;
  }

  console.log('Prospeo search exhausted all attempts:', attempts.join(' | '));
  return results;
}

function mapProspeoStatus(status: string): EmailCandidate['verified'] {
  const s = status.toLowerCase();
  if (s === 'valid' || s === 'verified') return 'valid';
  if (s === 'catch_all' || s === 'catch-all' || s === 'accept_all') return 'catch-all';
  if (s === 'invalid' || s === 'disposable') return 'invalid';
  return 'unknown';
}

interface ContactResult {
  candidates: EmailCandidate[];
  prospeoNote: string;
  contactName: string;
  contactTitle: string;
}

async function findVerifiedContact(
  ownerName: string,
  companyName: string,
  websiteUrl: string,
  foundEmails: string[],
  prospeoKey: string,
): Promise<ContactResult> {
  const candidates: EmailCandidate[] = [];
  let prospeoNote = '';
  let contactName = ownerName || '';
  let contactTitle = '';
  let domain = '';

  try {
    domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname.replace('www.', '');
  } catch { /* ignore */ }

  if (!domain) return { candidates, prospeoNote: 'Prospeo: skipped (no domain)', contactName, contactTitle };

  const added = new Set<string>();

  if (prospeoKey) {
    // Step 1: Search Prospeo for senior people at this company
    // Uses company name AND domain - ignores CH director name
    const searchResults = await prospeoSearchPerson(domain, companyName, prospeoKey);

    if (searchResults.length > 0) {
      // Filter search results: only keep people whose Prospeo company domain matches the prospect's domain
      // This prevents false matches where Prospeo returns people from unrelated companies
      const validResults = searchResults.filter(person => {
        const personDomain = person.companyDomain?.toLowerCase() || '';
        if (!personDomain) return false;
        return personDomain === domain || personDomain.endsWith(`.${domain}`) || domain.endsWith(`.${personDomain}`);
      });

      const skippedCount = searchResults.length - validResults.length;
      if (skippedCount > 0) {
        console.log(`Prospeo: filtered out ${skippedCount} of ${searchResults.length} results (wrong company domain). Target: ${domain}`);
      }

      // Enrich the top 3 validated results to get verified emails
      let enrichedCount = 0;
      const enrichedNames: string[] = [];
      for (const person of validResults.slice(0, 3)) {
        const enriched = await prospeoEnrich({ personId: person.personId }, prospeoKey);

        if (enriched && enriched.email && mapProspeoStatus(enriched.status) !== 'invalid') {
          const verified = mapProspeoStatus(enriched.status);
          const personName = person.fullName || enriched.fullName;

          candidates.push({
            email: enriched.email,
            source: `Prospeo verified (${person.title || person.seniority || 'Senior contact'})`,
            confidence: verified === 'valid' ? 'high' : 'medium',
            verified,
            name: personName,
            title: person.title || enriched.title || '',
          });
          added.add(enriched.email.toLowerCase());
          enrichedNames.push(`${personName} (${person.title || 'contact'})`);

          if (enrichedCount === 0) {
            contactName = personName;
            contactTitle = person.title || enriched.title || '';
          }
          enrichedCount++;
        }
      }

      if (enrichedCount > 0) {
        const namesStr = enrichedNames.join(', ');
        const nameParts = (ownerName || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const chWarning = ownerName && !enrichedNames.some(n => n.toLowerCase().includes(firstName.toLowerCase()))
          ? ` NOTE: CH director ${ownerName} not among Prospeo contacts.`
          : '';
        prospeoNote = `Prospeo search: found ${namesStr}${chWarning}`;
      } else {
        const filterNote = skippedCount > 0 ? ` (${skippedCount} results filtered out, wrong company)` : '';
        prospeoNote = `Prospeo search: found ${searchResults.length} people but none matched ${domain}${filterNote}`;
      }
    }

    // Step 2: If search found nothing, try enriching CH director by name as last resort
    if (candidates.length === 0) {
      const nameParts = (ownerName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length >= 2 ? nameParts[nameParts.length - 1] : '';

      if (firstName && lastName) {
        const found = await prospeoEnrich(
          { firstName: firstName.toLowerCase(), lastName: lastName.toLowerCase(), domain },
          prospeoKey,
        );

        if (found && found.email && mapProspeoStatus(found.status) !== 'invalid') {
          const verified = mapProspeoStatus(found.status);
          candidates.push({
            email: found.email,
            source: `Prospeo verified (${ownerName})`,
            confidence: verified === 'valid' ? 'high' : 'medium',
            verified,
            name: ownerName,
            title: found.title || 'Director (Companies House)',
          });
          added.add(found.email.toLowerCase());
          contactName = ownerName;
          contactTitle = found.title || 'Director';
          prospeoNote = `Prospeo enrich: found ${found.email} for CH director ${ownerName} (${verified})`;
        } else {
          const searchMsg = prospeoNote || 'Prospeo search: no results';
          prospeoNote = `${searchMsg}. Enrich ${ownerName}: not found`;
        }
      } else {
        const searchMsg = prospeoNote || 'Prospeo search: no results';
        prospeoNote = `${searchMsg}. No director name to enrich`;
      }
    }
  } else {
    prospeoNote = 'Prospeo: skipped (no API key)';
  }

  // Website emails as secondary candidates (informational, not primary send targets)
  for (const email of foundEmails) {
    if (!added.has(email.toLowerCase())) {
      const prefix = email.split('@')[0].toLowerCase();
      const isGeneric = GENERIC_PREFIXES.includes(prefix);
      candidates.push({
        email,
        source: isGeneric ? 'Website (generic)' : 'Website (personal)',
        confidence: 'low',
        verified: 'unchecked',
      });
      added.add(email.toLowerCase());
    }
  }

  return { candidates, prospeoNote, contactName, contactTitle };
}

export const POST: APIRoute = async ({ request }) => {
  const { prospect_id, manual_name, manual_email } = await request.json();

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

    // Step 1: Find verified contact
    // If manual contact provided (from dashboard resolution), skip Prospeo
    let emailCandidates: EmailCandidate[];
    let prospeoNote: string;
    let contactName: string;
    let contactTitle: string;
    let ownerEmail: string;
    let hasVerifiedContact: boolean;

    if (manual_name && manual_email) {
      // Manual contact from dashboard - treat as verified
      emailCandidates = [{
        email: manual_email,
        source: 'Manual (dashboard)',
        confidence: 'high' as const,
        verified: 'unchecked' as const,
        name: manual_name,
        title: '',
      }];
      prospeoNote = `Manual contact set: ${manual_name} <${manual_email}>`;
      contactName = manual_name;
      contactTitle = '';
      ownerEmail = manual_email;
      hasVerifiedContact = true;
    } else {
      // Normal Prospeo lookup - search by company name first, CH director name last
      const prospeoKey = getEnv('PROSPEO_API_KEY');
      const result = await findVerifiedContact(prospect.owner_name || '', prospect.company_name || '', prospect.website, foundEmails, prospeoKey);
      emailCandidates = result.candidates;
      prospeoNote = result.prospeoNote;
      contactName = result.contactName;
      contactTitle = result.contactTitle;
      ownerEmail = emailCandidates.length > 0 ? emailCandidates[0].email : '';
      hasVerifiedContact = emailCandidates.some(c => c.source && c.source.includes('Prospeo'));
    }

    if (!hasVerifiedContact) {
      // Store what we know (website emails as reference) but block the pipeline
      await supabase
        .from('outreach_prospects')
        .update({
          website_analysis: {
            prospeo_note: prospeoNote,
            ch_director: prospect.owner_name || '',
            needs_contact_reason: 'No Prospeo-verified contact found. Manual contact resolution required before email drafting.',
          },
          email_candidates: emailCandidates,
          pipeline_status: 'needs_contact',
        })
        .eq('id', prospect_id);

      return new Response(JSON.stringify({
        prospect_id,
        status: 'needs_contact',
        prospeo_note: prospeoNote,
        email_candidates: emailCandidates,
        message: 'No verified contact found. Set a contact manually to proceed.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use the verified contact name (may differ from CH director)
    const contactFirstName = contactName.split(/\s+/)[0] || '';

    // Build SIC description
    const sicCodes = prospect.sic_codes || [];
    const sicDescription = sicCodes.length > 0 ? `SIC codes: ${sicCodes.join(', ')}` : 'Industry unknown';

    // Step 2: Call Claude with the verified contact's name
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const contactLine = contactName
      ? `${contactName}${contactTitle ? ` (${contactTitle})` : ''}`
      : 'Unknown';

    const userPrompt = `Company: ${prospect.company_name}
Industry: ${sicDescription}
Website: ${prospect.website}
CH Director: ${prospect.owner_name || 'Unknown'}
Contact person for email: ${contactLine}
Contact first name for greeting: ${contactFirstName || 'NONE - use "Hi there" and flag in assessment'}
Location: ${prospect.address || 'UK'}
Google Rating from Google Maps: ${prospect.google_rating || 'N/A'}/5 (IMPORTANT: verify whether this rating is displayed ON the website or only exists externally. Do not round up.)
Accounts type: ${prospect.accounts_type || 'Unknown'}

Website content (homepage + about/team pages if found):
${websiteHTML}

INSTRUCTIONS:
1. Read ALL website content above thoroughly. For every element in the assessment checklist (reviews, lead magnets, portals, newsletters, blog, sectors, service promises, tech partnerships, team), explicitly confirm or deny its presence.
2. Check if the firm operates within a franchise. Check if the URL matches the trading name.
3. Note service promises and commitments that map to automation opportunities.
4. Choose the best email angle (1-4) based on verified findings. If you cannot verify a gap, do NOT use Angle 1 or 2.
5. Write the email addressed to ${contactFirstName || 'the director'}. The greeting, opening, and personalisation must be specific to this person where possible. If the contact person differs from the CH Director, personalise to the contact person.

Return JSON with this exact structure:
{
  "website_analysis": {
    "recommended_angle": 1-4,
    "angle_rationale": "why this angle was chosen, referencing specific verified evidence",
    "verified_elements": ["list every element confirmed on the site: reviews with count, lead magnets, portals, forms, blog topics, sectors, service promises, tech partnerships, team members with roles"],
    "missing_elements": ["elements checked but not found in the content provided"],
    "overall_score": "1-10",
    "design_quality": "brief assessment",
    "lead_capture": "what lead capture exists (verified: forms, popups, lead magnets, newsletter signups)",
    "contact_ease": "how easy to contact them (verified)",
    "key_observation": "the single most compelling thing about this business for personalisation",
    "growth_signals": "growth indicators, awards, news, acquisitions, hiring, recent team additions with dates, capacity notes",
    "service_promises": "any specific commitments (response times, turnaround guarantees, free consultations) that map to automation hooks",
    "existing_digital_signals": "client portals, email programmes, proprietary tools, tech integrations",
    "franchise_flag": "is this a franchise operation? does the prospect control their own website?",
    "contact_name_verified": "was the contact name found on the website? if so, where and what role?"
  },
  "improvement_ideas": [
    {
      "title": "specific automation/system name",
      "description": "2-3 sentences. Frame as a system that runs without human input. Reference specific site content (sectors, service promises, blog topics).",
      "impact": "time saved, manual work removed, enquiries generated"
    },
    {
      "title": "second automation/system",
      "description": "2-3 sentences framed as automation, referencing their specific business",
      "impact": "business impact"
    },
    {
      "title": "third automation/system",
      "description": "2-3 sentences framed as automation, referencing their specific business",
      "impact": "business impact"
    }
  ],
  "draft_email": {
    "subject": "2-4 words only. Curiosity without clickbait.",
    "body": "Start with 'Hi ${contactFirstName || 'there'},\\n\\n' then 120-160 words. Structure: Opening (lead with the hook, NO 'I came across') -> Bridge (1 sentence) -> Ideas ('Things like:' + 3 bullets as automations using their sector names/blog topics/service promises) -> Offer ('no cost, no catch' + automation build offer) -> CTA ('Worth me sharing some more details?') -> Sign off 'Will'. Use \\n\\n between paragraphs. Use \\n- for bullets."
  },
  "follow_up_1": {
    "subject": "Re: [same subject]",
    "body": "Start with 'Hi ${contactFirstName || 'there'},\\n\\n' then 50-80 words. Different angle, reference a specific idea. End on a question. Sign off 'Will'."
  },
  "follow_up_2": {
    "subject": "Re: [same subject]",
    "body": "Start with 'Hi ${contactFirstName || 'there'},\\n\\n' then 30-50 words. Final nudge, casual, no pressure. End on a question. Sign off 'Will'."
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

    // Store prospeo note and CH director in website_analysis for reference
    const websiteAnalysis = {
      ...analysis.website_analysis,
      prospeo_note: prospeoNote,
      ch_director: prospect.owner_name || '',
    };

    // Update prospect (owner_name becomes the verified contact we're emailing)
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
        owner_name: contactName || prospect.owner_name,
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
      owner_name: contactName || prospect.owner_name,
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
