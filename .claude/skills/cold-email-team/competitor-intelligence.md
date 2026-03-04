# Skill: Competitor Intelligence — Find Companies Using a Specific Tool

This skill documents all methods for identifying companies that use a named competitor product. It is used by the Competitor Intel Agent (Stage 0) and can be adapted for any competitor.

The current primary use case: finding companies using **TaxiforEmail** for the **EmailShepherd** client.

---

## Background: TaxiforEmail Acquisition Chain

Taxi for Email was acquired by SparkPost (2021), which was then acquired by MessageBird, which rebranded as **Bird** in 2024. Taxi is now Bird's email design module.

This acquisition chain is critical because companies using Taxi often also send via **SparkPost** (Bird's sending infrastructure), which leaves identifiable fingerprints in their outbound emails.

---

## Method 1 — Public Customers Page

**What:** Scrape the competitor's own website for named customers.

**How:**
1. Fetch `[competitor.com]/customers/`, `/clients/`, `/case-studies/`, `/partners/`
2. Also check the homepage for logo walls, testimonials, and quote blocks
3. Fetch each linked individual case study page — they often name the company in the title
4. Extract: company name, any linked domain or URL, any quoted job title

**Confidence:** `confirmed` — the competitor is publicly claiming them as a customer

**Known Taxi customers (pre-seeded):**
Debenhams, EF English Live, Encore Tickets, Genesys, Global Radio, Hachette, Kahoot!, Airbnb, Aman, Chestertons, Doddle, Farmdrop, NBC Universal, Photobox, QVC, Reuters TV, Sky, Snap Kitchen, TMW Unlimited, Zillow

---

## Method 2 — Review Platforms

**What:** Software review sites where users disclose their employer when leaving reviews.

**How:**
1. Fetch (or search for) reviews on:
   - `g2.com/products/[tool-slug]/reviews`
   - `capterra.com/p/[product-id]/[tool-name]/reviews/`
   - `trustradius.com/products/[tool]/reviews`
   - `trustpilot.com/review/[domain]`
2. Extract: reviewer's listed company name, job title, company size band
3. Many review sites show "Reviewer at [Company]" in the reviewer profile

**Notes:**
- G2 often blocks automated access (403). If blocked: note it and skip
- Capterra tends to be more accessible
- Company size band (e.g. "Mid-Market", "Enterprise") is useful for filtering later

**Confidence:** `verified` — reviewer has an account and stated employer

---

## Method 3 — Email Fingerprint Analysis (SparkPost/Bird Signal)

**What:** Identify companies sending email via SparkPost infrastructure — indicating Taxi use.

### The Fingerprint

Emails sent via SparkPost (Bird) contain one or more of these identifiers:

| Signal | Where to find it | What to look for |
|--------|-----------------|------------------|
| Tracking links | Email HTML body | Links redirecting through `spgo.io` |
| Feedback loop header | Email raw source | `X-MSFBL:` header present |
| Default bounce domain | Email raw source | `Return-Path:` contains `sparkpostmail.com` |
| Custom bounce domain | Email raw source | `Return-Path:` contains `sp.[company-domain].com` (SparkPost custom pattern) |

> Not all SparkPost users are Taxi users. But SparkPost users who are enterprise-grade email senders in industries like retail, media, travel, and financial services have a high probability of using Taxi for template production. Use industry + company size as additional filters.

### Step A — Validate the fingerprint (one-time setup per competitor)

1. Take 2–3 confirmed customers from Method 1 (e.g. Global Radio, Kahoot!, Encore Tickets)
2. Find their newsletter signup and subscribe
3. Receive one marketing email
4. In Gmail: open email → three-dot menu → "Show original" → copy the full raw source
5. Paste into the agent — it will check for the signals above
6. If confirmed in 2+ companies: fingerprint is validated for this competitor

### Step B — Analyse individual companies

Once fingerprint is validated, for any new company:
1. Find their newsletter signup (usually linked from their website footer)
2. Subscribe, receive one email, paste raw source to agent
3. Agent outputs: `SparkPost confirmed` / `Different ESP` / `Unable to determine`

### Step C — Use email archives (scale without subscribing)

Several services archive marketing emails with their HTML source visible:

- **Milled.com** — largest email newsletter archive. Search: `milled.com/search?q=[company-name]`. Some pages are accessible, others require Milled Pro.
- **Really Good Emails** (reallygoodemails.com) — curated archive with HTML source view
- **Email Love** (emaillove.com) — browseable by brand
- **HTML Email Gallery** — smaller but accessible

For each archived email found: check for `spgo.io` in link hrefs and `X-MSFBL` in raw headers.

**Confidence:** `likely` (SparkPost confirmed, not Taxi confirmed) → upgrade to `verified` if company also appeared in Method 1, 2, or 4

---

## Method 4 — Job Postings (LinkedIn + Google)

**What:** Active job postings that list TaxiforEmail as a required or preferred tool.

**Why it works:** When a company posts a job for an "Email Developer" or "Email Marketing Manager" and mentions Taxi in the job description, it is a direct signal of current or planned use.

**How:**
1. Web search: `site:linkedin.com/jobs "taxi for email"`
2. Web search: `"taxi for email" email developer OR designer job 2024 OR 2025`
3. Web search: `"taxi for email" "email marketing manager" OR "crm manager" OR "email developer"`
4. Extract company names from job listing titles and descriptions

**Confidence:** `verified` — active job posting = confirmed tool in their tech stack

---

## Method 5 — Integration Partner Pages

**What:** Taxi's integration partners sometimes list mutual customers in their case studies.

**Taxi's key integrations:**
- Braze (`braze.com/customers/`)
- CleverTap (`clevertap.com/customers/`)
- Fresh Relevance (`freshrelevance.com/customers/`)
- Dotdigital (`dotdigital.com/case-studies/`)
- Bird/SparkPost (same platform)
- Salesforce Marketing Cloud (enterprise overlap)

**How:**
1. Fetch each partner's customer/case study pages
2. Extract company names
3. Cross-reference: companies appearing on a Taxi integration partner's page AND who are known enterprise email senders = co-signal
4. Note: this is a co-signal only — not confirmation. Use to build the `likely` tier.

**Confidence:** `likely` — co-signal, not direct confirmation

---

## Method 6 — Web Search for Press and Testimonials

**What:** Find companies who have publicly mentioned using Taxi.

**Search queries to run:**
```
"taxi for email" "we use" OR "our team uses" OR "switched to"
"taxiforemail.com" -site:taxiforemail.com
"taxi for email" site:prnewswire.com OR site:businesswire.com
"taxi for email" case study OR testimonial OR review
"taxi for email" email team OR email production 2023 OR 2024 OR 2025
"taxi for email" partners OR integration announcement
```

Extract company names from any press releases, blog posts, or testimonials found.

**Confidence:** `verified` if they're quoted saying they use it; `likely` if mentioned in context

---

## Method 7 — Social Mentions

**What:** Companies that have publicly posted about TaxiforEmail on social media.

**How:**
1. Web search: `"taxi for email" site:twitter.com OR site:x.com`
2. Web search: `"taxi for email" site:linkedin.com`
3. Look for company accounts (not individuals) who have posted about using Taxi

**Confidence:** `verified` if a company's official account posted about it; `likely` if an employee did

---

## Output Format

All findings feed into a single deduplicated CSV:

```csv
company_name,domain,confidence,sources,notes
Global Radio,globalradio.com,confirmed,customers_page,Named in case study
Kahoot!,kahoot.com,confirmed,customers_page + job_posting,Also job posting found 2024
[Company],example.com,likely,integration_partner + web_search,Appeared on Braze customers page
```

**Confidence tiers:**
- `confirmed` — competitor's own public customer list
- `verified` — review platform, job posting, direct quote
- `likely` — indirect signals (co-integration, fingerprint only, social mention)

---

## SparkPost Fingerprint Reference Card

When analysing email source code, look for these exact patterns:

```
IN EMAIL HEADERS (raw source) — CHECK THESE FIRST:
X-MSFBL:                                    ← Most reliable signal. Present in virtually all SparkPost mail.
Received: from ... .prd.sparkpost           ← SparkPost MTA in delivery chain
Message-ID: <...@...prd.sparkpost>         ← SparkPost-generated Message-ID
Return-Path: <...@sparkpostmail.com>       ← Only if company hasn't set custom bounce domain

IN LINK HREFS — less reliable (many use custom tracking domains):
spgo.io/                                    ← SparkPost default. Often replaced with custom domain.
click.sparkpost.com/
```

**Hierarchy of reliability:**
1. `X-MSFBL` header — definitive. If present, it's SparkPost.
2. SparkPost in `Received` chain — definitive.
3. `spgo.io` tracking links — useful but NOT present if company has a custom tracking domain (e.g. `click.mail.zillow.com`).

**Validated in practice (2026-02-24):**
- **Zillow**: SparkPost CONFIRMED — `X-MSFBL` present, SparkPost MTA in `Received` headers. Uses custom tracking domain (`click.mail.zillow.com`), so `spgo.io` would NOT have caught them.
- **Kahoot!**: **SendGrid**, NOT SparkPost — confirmed Taxi customer but uses SendGrid for transactional email. Shows that SparkPost fingerprint does NOT catch all Taxi users.

**Critical limitation:** Taxi works with many ESPs (Braze, Dotdigital, Campaign Monitor, SendGrid, Marketo, Iterable, etc.). SparkPost fingerprinting only identifies companies using Taxi+SparkPost specifically — not all Taxi users. Use as a *confirmation* tool, not a primary *discovery* method.

---

## Notes on Scale

- Methods 1–2 and 4–7 are largely automated (web search + page fetch)
- Method 3 (email fingerprinting) requires either manual newsletter subscriptions or access to email archives
- A typical first run should yield 20–50 companies from automated methods alone
- With email fingerprinting applied to target industries, the list can grow to 100–200+ over time
