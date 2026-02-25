/**
 * Dropbox integration adapter using the Dropbox API v2.
 * Stores chapters as individual JSON files in a configurable folder.
 */

import type { Chapter, IntegrationConfig } from '@/types';
import { normalizeProviderPullResponse } from './orchestration';
import type { IntegrationAdapter, ProviderDocument, ProviderPayload, RemoteRevision } from './types';
import { IntegrationApiError } from './api';

const DROPBOX_API = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT = 'https://content.dropboxapi.com/2';
const MANIFEST_FILE = '_manifest.json';

function ensureToken(config: IntegrationConfig): string {
  if (!config.sessionToken) {
    throw new IntegrationApiError(
      'Dropbox session token is missing. Connect your account first.',
      { code: 'UNAUTHORIZED', status: 401 }
    );
  }
  return config.sessionToken;
}

function getFolderPath(config: IntegrationConfig): string {
  const folder = config.folderId || '/DraftHarbour';
  return folder.startsWith('/') ? folder : `/${folder}`;
}

async function dropboxFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new IntegrationApiError('Dropbox token expired or invalid. Refresh your connection.', {
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }

  if (response.status === 409) {
    const body = await response.json().catch(() => ({}));
    const tag = (body as { error?: { '.tag'?: string } })?.error?.['.tag'];
    if (tag === 'path' || tag === 'path_lookup') {
      throw new IntegrationApiError('Dropbox path not found. Check your folder path.', {
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  }

  if (response.status === 429) {
    throw new IntegrationApiError('Dropbox rate limit reached. Try again later.', {
      code: 'RATE_LIMITED',
      status: 429,
    });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new IntegrationApiError(
      `Dropbox API error (${response.status}): ${errorText || response.statusText}`,
      { code: 'UNKNOWN', status: response.status }
    );
  }

  return response;
}

async function ensureFolderExists(token: string, folderPath: string): Promise<void> {
  try {
    await dropboxFetch(`${DROPBOX_API}/files/create_folder_v2`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, autorename: false }),
    });
  } catch (err) {
    // Folder may already exist (409 with path/conflict) — that's fine
    if (err instanceof IntegrationApiError && err.status === 404) {
      // Path issue, re-throw
      throw err;
    }
    // Try to check if folder exists by getting metadata
    try {
      await dropboxFetch(`${DROPBOX_API}/files/get_metadata`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
    } catch {
      throw new IntegrationApiError(`Could not access or create folder: ${folderPath}`, {
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  }
}

async function uploadFile(token: string, path: string, content: string): Promise<void> {
  await fetch(`${DROPBOX_CONTENT}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
    },
    body: content,
  });
}

async function downloadFile(token: string, path: string): Promise<string | null> {
  try {
    const response = await fetch(`${DROPBOX_CONTENT}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

interface DropboxEntry {
  '.tag': 'file' | 'folder';
  name: string;
  path_lower: string;
  path_display: string;
  server_modified?: string;
  rev?: string;
  id?: string;
}

interface DropboxListResponse {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

async function listFiles(token: string, folderPath: string): Promise<DropboxEntry[]> {
  const allEntries: DropboxEntry[] = [];

  const response = await dropboxFetch(`${DROPBOX_API}/files/list_folder`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath, recursive: false }),
  });

  const data = (await response.json()) as DropboxListResponse;
  allEntries.push(...data.entries);

  let cursor = data.cursor;
  let hasMore = data.has_more;

  while (hasMore) {
    const contResponse = await dropboxFetch(`${DROPBOX_API}/files/list_folder/continue`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor }),
    });

    const contData = (await contResponse.json()) as DropboxListResponse;
    allEntries.push(...contData.entries);
    cursor = contData.cursor;
    hasMore = contData.has_more;
  }

  return allEntries.filter((e) => e['.tag'] === 'file');
}

export const dropboxDirectAdapter: IntegrationAdapter = {
  type: 'dropbox',

  async connect(config: IntegrationConfig) {
    const token = ensureToken(config);
    const folderPath = getFolderPath(config);

    // Verify connection by checking the account
    await dropboxFetch(`${DROPBOX_API}/users/get_current_account`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });

    // Ensure the sync folder exists
    await ensureFolderExists(token, folderPath);

    return {
      message: `Connected to Dropbox folder "${folderPath}".`,
      syncedAt: Date.now(),
    };
  },

  async testConnection(config: IntegrationConfig) {
    const token = ensureToken(config);

    const response = await dropboxFetch(`${DROPBOX_API}/users/get_current_account`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });

    const data = (await response.json()) as { name?: { display_name?: string }; email?: string };
    const name = data.name?.display_name || data.email || 'your account';

    return {
      message: `Dropbox connection verified for ${name}. Folder: ${getFolderPath(config)}`,
      syncedAt: Date.now(),
    };
  },

  async pull(config: IntegrationConfig, _payload: ProviderPayload, localChapters: Chapter[]) {
    const token = ensureToken(config);
    const folderPath = getFolderPath(config);

    // List all chapter JSON files in the folder
    let entries: DropboxEntry[];
    try {
      entries = await listFiles(token, folderPath);
    } catch {
      // Folder might not exist yet - no remote data
      return {
        chapterUpdates: localChapters,
        remoteRevision: `dropbox-empty-${Date.now()}`,
        conflicts: [],
      };
    }

    // Download and parse each chapter JSON file
    const remoteDocs: ProviderDocument[] = [];
    for (const entry of entries) {
      if (entry.name === MANIFEST_FILE || !entry.name.endsWith('.json')) continue;

      const content = await downloadFile(token, entry.path_display || entry.path_lower);
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
        remoteRevision: `dropbox-empty-${Date.now()}`,
        conflicts: [],
      };
    }

    const latestEntry = entries
      .filter((e) => e.server_modified)
      .sort((a, b) => new Date(b.server_modified!).getTime() - new Date(a.server_modified!).getTime())[0];

    const remoteRevision = latestEntry?.rev
      ? `dropbox-rev-${latestEntry.rev}`
      : `dropbox-${Date.now()}`;

    return normalizeProviderPullResponse(localChapters, remoteDocs, remoteRevision, 'dropbox');
  },

  async push(config: IntegrationConfig, payload: ProviderPayload) {
    const token = ensureToken(config);
    const folderPath = getFolderPath(config);

    await ensureFolderExists(token, folderPath);

    // Upload each chapter as a JSON file
    for (const chapter of payload.chapters) {
      const filePath = `${folderPath}/${chapter.id}.json`;
      await uploadFile(token, filePath, JSON.stringify(chapter, null, 2));
    }

    // Upload a manifest with project metadata
    const manifest = {
      novelId: payload.novelId,
      projectType: payload.projectType,
      chapterIds: payload.chapters.map((c) => c.id),
      syncedAt: Date.now(),
    };
    await uploadFile(token, `${folderPath}/${MANIFEST_FILE}`, JSON.stringify(manifest, null, 2));

    return {
      message: `Uploaded ${payload.chapters.length} chapter(s) to Dropbox "${folderPath}".`,
      syncedAt: Date.now(),
    };
  },

  async listRemoteRevisions(config: IntegrationConfig): Promise<RemoteRevision[]> {
    const token = ensureToken(config);
    const folderPath = getFolderPath(config);

    let entries: DropboxEntry[];
    try {
      entries = await listFiles(token, folderPath);
    } catch {
      return [];
    }

    // Get revisions for the manifest file to track sync history
    const manifestPath = `${folderPath}/${MANIFEST_FILE}`;
    try {
      const response = await dropboxFetch(`${DROPBOX_API}/files/list_revisions`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: manifestPath, limit: 10 }),
      });

      const data = (await response.json()) as {
        entries: Array<{ rev: string; server_modified: string }>;
      };

      return data.entries.map((revision, index) => ({
        id: `dropbox-rev-${revision.rev}`,
        label: index === 0 ? 'Latest Sync' : `Sync ${new Date(revision.server_modified).toLocaleString()}`,
        updatedAt: new Date(revision.server_modified).getTime(),
      }));
    } catch {
      // No revisions available - return based on file listing
      return entries
        .filter((e) => e.server_modified && e.name !== MANIFEST_FILE)
        .slice(0, 5)
        .map((e) => ({
          id: e.rev ? `dropbox-rev-${e.rev}` : `dropbox-file-${e.name}`,
          label: `${e.name.replace('.json', '')}`,
          updatedAt: new Date(e.server_modified!).getTime(),
        }));
    }
  },
};
