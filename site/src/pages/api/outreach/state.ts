import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { isAuthed } from './auth';

export const prerender = false;
const env = (k: string) => (import.meta.env[k] || process.env[k] || '') as string;
const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

export const GET: APIRoute = async ({ request }) => {
  if (!isAuthed(request)) return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
  const { data, error } = await db().from('outreach_state').select('*');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ rows: data || [] }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthed(request)) return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401 });
  const { company, state } = await request.json().catch(() => ({}));
  if (!company || !state) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });
  const row = {
    company, stage: state.stage || 'companies', prev_stage: state.prevStage || null,
    trigger: state.trigger || '', source: state.source || '', subject: state.subject || 'Email production',
    contacts: state.contacts || [], emails: state.emails || [], generated: !!state.generated,
    sent_at: state.sentAt || null, updated_at: new Date().toISOString(),
  };
  const { error } = await db().from('outreach_state').upsert(row, { onConflict: 'company' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
