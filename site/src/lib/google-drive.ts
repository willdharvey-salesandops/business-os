import { google } from 'googleapis';

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getAuth() {
  const raw = getEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON env var');

  let credentialsJson = raw;
  // Handle base64-encoded credentials
  if (!raw.startsWith('{')) {
    try {
      credentialsJson = Buffer.from(raw, 'base64').toString('utf-8');
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or base64');
    }
  }

  const credentials = JSON.parse(credentialsJson);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
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
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='video/mp4' and trashed=false`,
    fields: 'files(id, name, mimeType, createdTime)',
    orderBy: 'name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files || []) as DriveFile[];
}

/**
 * List image files in a folder (for thumbnails)
 */
export async function listImageFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png') and trashed=false`,
    fields: 'files(id, name, mimeType, createdTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files || []) as DriveFile[];
}

/**
 * Move a file from one folder to another
 */
export async function moveFile(fileId: string, fromFolderId: string, toFolderId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: fromFolderId,
    supportsAllDrives: true,
  });
}

/**
 * Get a direct download URL for a file (using export/webContentLink approach)
 * For Creatomate, we need a publicly accessible URL. We temporarily make the file
 * accessible via a sharing link.
 */
export async function getDownloadUrl(fileId: string): Promise<string> {
  const drive = getDrive();

  // Create a temporary anyone-with-link permission
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
    supportsAllDrives: true,
  });

  // Return the direct download link
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${getEnv('GOOGLE_DRIVE_API_KEY')}`;
}

/**
 * Get download URL using service account auth (streams through our server)
 * Alternative: use webContentLink after sharing
 */
export async function getWebContentLink(fileId: string): Promise<string> {
  const drive = getDrive();

  // Make file accessible via link
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch {
    // Permission may already exist
  }

  const file = await drive.files.get({
    fileId,
    fields: 'webContentLink',
    supportsAllDrives: true,
  });

  return file.data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Remove public sharing permission after Creatomate has fetched the file
 */
export async function revokePublicAccess(fileId: string): Promise<void> {
  const drive = getDrive();
  try {
    const permissions = await drive.permissions.list({
      fileId,
      supportsAllDrives: true,
    });
    const anyonePermission = permissions.data.permissions?.find(p => p.type === 'anyone');
    if (anyonePermission?.id) {
      await drive.permissions.delete({
        fileId,
        permissionId: anyonePermission.id,
        supportsAllDrives: true,
      });
    }
  } catch {
    // Best effort cleanup
  }
}
