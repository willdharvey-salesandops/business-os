import type { APIRoute } from 'astro';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

/**
 * One-time OAuth2 setup for YouTube Data API.
 *
 * Step 1: Visit this URL → redirects to Google consent screen
 * Step 2: After consent, Google redirects back with ?code=xxx
 * Step 3: Code is exchanged for tokens, refresh token is displayed
 * Step 4: Copy refresh token into YOUTUBE_REFRESH_TOKEN env var in Vercel
 *
 * Prerequisites:
 * - YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET set in Vercel env vars
 * - YouTube Data API v3 enabled in Google Cloud Console
 * - OAuth consent screen configured (can be in "Testing" mode)
 * - Redirect URI added: https://leadershipgrowthconsulting.com/api/content-pipeline/youtube-auth
 */
export const GET: APIRoute = async ({ url }) => {
  const code = url.searchParams.get('code');
  const clientId = getEnv('YOUTUBE_CLIENT_ID');
  const clientSecret = getEnv('YOUTUBE_CLIENT_SECRET');
  const siteUrl = getEnv('SITE_URL') || 'https://leadershipgrowthconsulting.com';
  const redirectUri = `${siteUrl}/api/content-pipeline/youtube-auth`;

  if (!clientId || !clientSecret) {
    return new Response('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET env vars', { status: 500 });
  }

  // Step 1: Redirect to Google consent screen
  if (!code) {
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`;
    return Response.redirect(authUrl, 302);
  }

  // Step 2: Exchange code for tokens
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await res.json();

  if (data.refresh_token) {
    return new Response(
      `<html>
<head><title>YouTube Auth Complete</title></head>
<body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px;">
  <h1>YouTube Auth Complete</h1>
  <p>Add this as <strong>YOUTUBE_REFRESH_TOKEN</strong> in Vercel:</p>
  <pre style="background: #f0f0f0; padding: 16px; border-radius: 8px; word-break: break-all;">${data.refresh_token}</pre>
  <p style="color: #666; margin-top: 20px;">After adding the env var, redeploy your site. You can then delete this page's URL from your browser history.</p>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  return new Response(
    `<html>
<head><title>YouTube Auth Error</title></head>
<body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px;">
  <h1>Auth Error</h1>
  <pre style="background: #fff0f0; padding: 16px; border-radius: 8px;">${JSON.stringify(data, null, 2)}</pre>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
};
