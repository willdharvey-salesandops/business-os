import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

export const prerender = false;
const env = (k: string) => (import.meta.env[k] || process.env[k] || '') as string;
const token = () => crypto.createHash('sha256').update('es-outreach:' + env('OUTREACH_PASSWORD')).digest('hex');
const cookieValid = (req: Request) => {
  const c = req.headers.get('cookie') || '';
  const m = c.match(/(?:^|;\s*)outreach_auth=([a-f0-9]+)/);
  return !!m && !!env('OUTREACH_PASSWORD') && m[1] === token();
};
export const isAuthed = cookieValid;

export const GET: APIRoute = async ({ request }) =>
  new Response(JSON.stringify({ ok: cookieValid(request) }), { headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const { password } = await request.json().catch(() => ({ password: '' }));
  if (!env('OUTREACH_PASSWORD') || password !== env('OUTREACH_PASSWORD'))
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `outreach_auth=${token()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
    },
  });
};
