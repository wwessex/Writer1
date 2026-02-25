/**
 * Google Drive integration adapter using the Drive REST API v3.
 * Stores chapters as individual JSON files in a DraftHarbour app folder.
 */

import type { Chapter, IntegrationConfig } from '@/types';
import { normalizeProviderPullResponse } from './orchestration';
import type { IntegrationAdapter, ProviderDocument, ProviderPayload, RemoteRevision } from './types';
import { IntegrationApiError } from './api';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER_NAME = 'DraftHarbour';
const MANIFEST_NAME = '_manifest.json';

function ensureToken(config: IntegrationConfig): string {
  if (!config.sessionToken) {
    throw new IntegrationApiError(
      'Google Drive session token is missing. Connect your account first.',
      { code: 'UNAUTHORIZED', status: 401 }
    );
  }
  return config.sessionToken;
}

async function driveFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new IntegrationApiError(
      'Google Drive token expired or invalid. Refresh your connection.',
      { code: 'UNAUTHORIZED', status: 401 }
    );
  }

  if (response.status === 403) {
    throw new IntegrationApiError(
      'Google Drive access denied. Check that the app has permission to access your files.',
      { code: 'UNAUTHORIZED', status: 403 }
    );
  }

  if (response.status === 404) {
    throw new IntegrationApiError('Google Drive resource not found.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  if (response.status === 429) {
    throw new IntegrationApiError('Google Drive rate limit reached. Try again later.', {
      code: 'RATE_LIMITED',
      status: 429,
    });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new IntegrationApiError(
      `Google Drive API error (${response.status}): ${errorText || response.statusText}`,
      { code: 'UNKNOWN', status: response.status }
    );
  }

  return response;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
}

interface DriveFileList {
  files: DriveFile[];
  nextPageToken?: string;
}

/**
 * Find or create the DraftHarbour app folder in the user's Drive.
 */
async function getOrCreateAppFolder(token: string, folderName: string = APP_FOLDER_NAME): Promise<string> {
  // Search for existing folder
  const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`;

  const searchResponse = await driveFetch(searchUrl, token);
  const searchData = (await searchResponse.json()) as DriveFileList;

  if (searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create the folder
  const createResponse = await driveFetch(`${DRIVE_API}/files`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const created = (await createResponse.json()) as DriveFile;
  return created.id;
}

/**
 * List all JSON files in the app folder.
 */
async function listFilesInFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const query = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
    let url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,mimeType)&spaces=drive&pageSize=100`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await driveFetch(url, token);
    const data = (await response.json()) as DriveFileList;
    allFiles.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Download a file's content from Google Drive.
 */
async function downloadFile(token: string, fileId: string): Promise<string | null> {
  try {
    const response = await driveFetch(
      `${DRIVE_API}/files/${fileId}?alt=media`,
      token
    );
    return response.text();
  } catch {
    return null;
  }
}

/**
 * Find a file by name in a folder.
 */
async function findFileByName(token: string, folderId: string, fileName: string): Promise<DriveFile | null> {
  const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)`;

  const response = await driveFetch(url, token);
  const data = (await response.json()) as DriveFileList;
  return data.files[0] || null;
}

/**
 * Create or update a file in Google Drive.
 */
async function upsertFile(
  token: string,
  folderId: string,
  fileName: string,
  content: string
): Promise<DriveFile> {
  const existing = await findFileByName(token, folderId, fileName);

  if (existing) {
    // Update existing file
    const response = await fetch(
      `${DRIVE_UPLOAD}/files/${existing.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: content,
      }
    );

    if (!response.ok) {
      throw new IntegrationApiError(
        `Failed to update file "${fileName}" on Google Drive.`,
        { code: 'UNKNOWN', status: response.status }
      );
    }

    return response.json() as Promise<DriveFile>;
  }

  // Create new file with multipart upload
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json',
  };

  const boundary = `draftharbour_${Date.now()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const response = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    throw new IntegrationApiError(
      `Failed to create file "${fileName}" on Google Drive.`,
      { code: 'UNKNOWN', status: response.status }
    );
  }

  return response.json() as Promise<DriveFile>;
}

export const googleDriveDirectAdapter: IntegrationAdapter = {
  type: 'google-drive',

  async connect(config: IntegrationConfig) {
    const token = ensureToken(config);

    // Verify connection by checking the Drive about endpoint
    await driveFetch(`${DRIVE_API}/about?fields=user`, token);

    // Ensure app folder exists
    const folderId = await getOrCreateAppFolder(token);

    return {
      message: `Connected to Google Drive. App folder ID: ${folderId}`,
      syncedAt: Date.now(),
    };
  },

  async testConnection(config: IntegrationConfig) {
    const token = ensureToken(config);

    const response = await driveFetch(`${DRIVE_API}/about?fields=user,storageQuota`, token);
    const data = (await response.json()) as {
      user?: { displayName?: string; emailAddress?: string };
      storageQuota?: { usage?: string; limit?: string };
    };

    const name = data.user?.displayName || data.user?.emailAddress || 'your account';
    const usageMb = data.storageQuota?.usage
      ? `${Math.round(Number(data.storageQuota.usage) / 1048576)} MB used`
      : '';

    return {
      message: `Google Drive connection verified for ${name}.${usageMb ? ` ${usageMb}.` : ''}`,
      syncedAt: Date.now(),
    };
  },

  async pull(config: IntegrationConfig, _payload: ProviderPayload, localChapters: Chapter[]) {
    const token = ensureToken(config);

    // Get or create app folder
    const folderId = await getOrCreateAppFolder(token);

    // List all chapter files
    const files = await listFilesInFolder(token, folderId);

    // Download and parse each chapter JSON file
    const remoteDocs: ProviderDocument[] = [];
    for (const file of files) {
      if (file.name === MANIFEST_NAME) continue;

      const content = await downloadFile(token, file.id);
      if (!content) continue;

      try {
        const doc = JSON.parse(content) as ProviderDocument;
        remoteDocs.push(doc);
      } catch {
        // Skip malformed files
      }
    }

    if (remoteDocs.length === 0) {
      return {
        chapterUpdates: localChapters,
        remoteRevision: `gdrive-empty-${Date.now()}`,
        conflicts: [],
      };
    }

    const latestFile = files
      .filter((f) => f.modifiedTime && f.name !== MANIFEST_NAME)
      .sort((a, b) => new Date(b.modifiedTime!).getTime() - new Date(a.modifiedTime!).getTime())[0];

    const remoteRevision = latestFile
      ? `gdrive-${latestFile.id}-${new Date(latestFile.modifiedTime!).getTime()}`
      : `gdrive-${Date.now()}`;

    return await normalizeProviderPullResponse(localChapters, remoteDocs, remoteRevision, 'google-drive');
  },

  async push(config: IntegrationConfig, payload: ProviderPayload) {
    const token = ensureToken(config);

    const folderId = await getOrCreateAppFolder(token);

    // Upload each chapter as a JSON file
    for (const chapter of payload.chapters) {
      await upsertFile(token, folderId, `${chapter.id}.json`, JSON.stringify(chapter, null, 2));
    }

    // Upload manifest
    const manifest = {
      novelId: payload.novelId,
      projectType: payload.projectType,
      chapterIds: payload.chapters.map((c) => c.id),
      syncedAt: Date.now(),
    };
    await upsertFile(token, folderId, MANIFEST_NAME, JSON.stringify(manifest, null, 2));

    return {
      message: `Pushed ${payload.chapters.length} chapter(s) to Google Drive.`,
      syncedAt: Date.now(),
    };
  },

  async listRemoteRevisions(config: IntegrationConfig): Promise<RemoteRevision[]> {
    const token = ensureToken(config);

    const folderId = await getOrCreateAppFolder(token);

    // Find the manifest file and get its revision history
    const manifestFile = await findFileByName(token, folderId, MANIFEST_NAME);

    if (manifestFile) {
      try {
        const response = await driveFetch(
          `${DRIVE_API}/files/${manifestFile.id}/revisions?fields=revisions(id,modifiedTime)`,
          token
        );

        const data = (await response.json()) as {
          revisions: Array<{ id: string; modifiedTime: string }>;
        };

        return data.revisions
          .sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())
          .slice(0, 10)
          .map((rev, index) => ({
            id: `gdrive-rev-${rev.id}`,
            label: index === 0 ? 'Latest Sync' : `Sync ${new Date(rev.modifiedTime).toLocaleString()}`,
            updatedAt: new Date(rev.modifiedTime).getTime(),
          }));
      } catch {
        // Revisions API may not be available for all file types
      }
    }

    // Fallback: list files with their modified times
    const files = await listFilesInFolder(token, folderId);
    return files
      .filter((f) => f.modifiedTime && f.name !== MANIFEST_NAME)
      .sort((a, b) => new Date(b.modifiedTime!).getTime() - new Date(a.modifiedTime!).getTime())
      .slice(0, 10)
      .map((f) => ({
        id: `gdrive-file-${f.id}`,
        label: f.name.replace('.json', ''),
        updatedAt: new Date(f.modifiedTime!).getTime(),
      }));
  },
};
