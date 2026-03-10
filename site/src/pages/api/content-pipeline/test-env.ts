import type { APIRoute } from 'astro';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

export const GET: APIRoute = async () => {
  const raw = getEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  const inbox = getEnv('DRIVE_SHORTS_INBOX_ID');
  const creatomate = getEnv('CREATOMATE_API_KEY');

  let parseResult = 'not attempted';
  let clientEmail = '';
  let hasPrivateKey = false;

  if (raw) {
    try {
      let json = raw;
      if (!raw.startsWith('{')) {
        json = Buffer.from(raw, 'base64').toString('utf-8');
      }
      const parsed = JSON.parse(json);
      parseResult = 'success';
      clientEmail = parsed.client_email || 'missing';
      hasPrivateKey = !!parsed.private_key;
    } catch (e: any) {
      parseResult = `parse error: ${e.message}`;
    }
  }

  return new Response(JSON.stringify({
    has_service_account: !!raw,
    service_account_length: raw?.length || 0,
    first_char: raw?.charAt(0) || 'empty',
    parse_result: parseResult,
    client_email: clientEmail,
    has_private_key: hasPrivateKey,
    has_inbox: !!inbox,
    has_creatomate: !!creatomate,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
