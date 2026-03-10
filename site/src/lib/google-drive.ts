import * as crypto from 'crypto';

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function getCredentials(): ServiceAccountCredentials {
  const raw = getEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON env var');

  let json = raw;
  if (!raw.startsWith('{')) {
    json = Buffer.from(raw, 'base64').toString('utf-8');
  }

  const parsed = JSON.parse(json);
  let privateKey = parsed.private_key;

  // Fix literal \n from env var storage
  if (privateKey && !privateKey.includes('\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return { client_email: parsed.client_email, private_key: privateKey };
}

function base64url(data: string | Buffer): string {
  return Buffer.from(data).toString('base64url');
}

async function getAccessToken(): Promise<string> {
  const creds = getCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(creds.private_key, 'base64url');

  const jwt = `${signInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function driveRequest(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  const url = path.startsWith('http') ? path : `${DRIVE_API}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }

  return res.json();
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
}

/**
 * List .mp4 files in a Google Drive folder
 */
export async function listFiles(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType='video/mp4' and trashed=false`);
  const fields = encodeURIComponent('files(id, name, mimeType, createdTime)');
  const data = await driveRequest(`/files?q=${q}&fields=${fields}&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return (data.files || []) as DriveFile[];
}

/**
 * List image files in a folder (for thumbnails)
 */
export async function listImageFiles(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png') and trashed=false`);
  const fields = encodeURIComponent('files(id, name, mimeType, createdTime)');
  const data = await driveRequest(`/files?q=${q}&fields=${fields}&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  return (data.files || []) as DriveFile[];
}

/**
 * Move a file from one folder to another
 */
export async function moveFile(fileId: string, fromFolderId: string, toFolderId: string): Promise<void> {
  await driveRequest(`/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}&supportsAllDrives=true`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
}

/**
 * Make file publicly accessible and return a direct download link for Creatomate
 */
export async function getWebContentLink(fileId: string): Promise<string> {
  // Create a temporary anyone-with-link permission
  try {
    await driveRequest(`/files/${fileId}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch {
    // Permission may already exist
  }

  const file = await driveRequest(`/files/${fileId}?fields=webContentLink&supportsAllDrives=true`);
  return file.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Remove public sharing permission after Creatomate has fetched the file
 */
export async function revokePublicAccess(fileId: string): Promise<void> {
  try {
    const data = await driveRequest(`/files/${fileId}/permissions?supportsAllDrives=true`);
    const anyonePerm = data.permissions?.find((p: any) => p.type === 'anyone');
    if (anyonePerm?.id) {
      const token = await getAccessToken();
      await fetch(`${DRIVE_API}/files/${fileId}/permissions/${anyonePerm.id}?supportsAllDrives=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    }
  } catch {
    // Best effort cleanup
  }
}
