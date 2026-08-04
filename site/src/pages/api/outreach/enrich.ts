import type { APIRoute } from 'astro';
import { isAuthed } from './auth';

export const prerender = false;
const env = (k: string) => (import.meta.env[k] || process.env[k] || '') as string;

const TITLE_QUERY = '(CRM OR email OR lifecycle OR retention OR "marketing automation" OR "marketing operations")';
const SENIORITY = ['Head', 'Director', 'Manager', 'Senior'];
const MAXP = 3;

async function call(filters: any, key: string) {
  const r = await fetch('https://api.prospeo.io/search-person', {
    method: 'POST',
    headers: { 'X-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 1, filters }),
  });
  if (!r.ok) return null;
  return r.json();
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthed(request)) return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
  const key = env('OUTREACH_PROSPEO_KEY') || env('PROSPEO_API_KEY');
  if (!key) return new Response(JSON.stringify({ error: 'no key' }), { status: 500 });
  const { company, domain } = await request.json().catch(() => ({}));

  const base: any = { person_job_title: { boolean_search: TITLE_QUERY }, person_seniority: { include: SENIORITY }, max_person_per_company: MAXP };
  let res: any = null;
  if (domain) res = await call({ ...base, company: { websites: { include: [domain] } } }, key);
  if ((!res || !(res.results || []).length) && company)
    res = await call({ person_job_title: { boolean_search: TITLE_QUERY }, max_person_per_company: MAXP, company: { names: { include: [company] } } }, key);

  const contacts = ((res && res.results) || []).slice(0, MAXP).map((r: any) => {
    const p = r.person || {}, e = p.email || {};
    return e.status === 'VERIFIED' && e.email
      ? { name: p.full_name || '', title: p.current_job_title || '', email: e.email, linkedin: p.linkedin_url || '' }
      : null;
  }).filter(Boolean);

  return new Response(JSON.stringify({ contacts, free: !!(res && res.free) }), { headers: { 'Content-Type': 'application/json' } });
};
