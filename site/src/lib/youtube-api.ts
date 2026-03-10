function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const YOUTUBE_UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Check if YouTube OAuth credentials are configured
 */
export function isConfigured(): boolean {
  return !!(getEnv('YOUTUBE_CLIENT_ID') && getEnv('YOUTUBE_CLIENT_SECRET') && getEnv('YOUTUBE_REFRESH_TOKEN'));
}

/**
 * Get a fresh OAuth2 access token using the stored refresh token
 */
async function getAccessToken(): Promise<string> {
  const clientId = getEnv('YOUTUBE_CLIENT_ID');
  const clientSecret = getEnv('YOUTUBE_CLIENT_SECRET');
  const refreshToken = getEnv('YOUTUBE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing YouTube OAuth credentials (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN)');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  privacyStatus?: 'public' | 'private' | 'unlisted';
}

/**
 * Upload a video to YouTube using resumable upload.
 * Note: requires sufficient function timeout for large files.
 */
export async function uploadVideo(
  videoBuffer: ArrayBuffer,
  metadata: VideoMetadata,
): Promise<{ videoId: string; url: string }> {
  const token = await getAccessToken();

  // Step 1: Initiate resumable upload
  const initRes = await fetch(
    `${YOUTUBE_UPLOAD_API}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': String(videoBuffer.byteLength),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId || '22',
        },
        status: {
          privacyStatus: metadata.privacyStatus || 'public',
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  );

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`YouTube upload init failed: ${initRes.status} ${text}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL returned from YouTube');

  // Step 2: Upload the video binary
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`YouTube upload failed: ${uploadRes.status} ${text}`);
  }

  const video = await uploadRes.json();
  return {
    videoId: video.id,
    url: `https://youtube.com/watch?v=${video.id}`,
  };
}

/**
 * Set a custom thumbnail for a YouTube video
 */
export async function setThumbnail(
  videoId: string,
  thumbnailBuffer: ArrayBuffer,
  mimeType: string = 'image/jpeg',
): Promise<void> {
  const token = await getAccessToken();

  const res = await fetch(
    `${YOUTUBE_UPLOAD_API}/thumbnails/set?videoId=${videoId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: thumbnailBuffer,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube thumbnail upload failed: ${res.status} ${text}`);
  }
}
