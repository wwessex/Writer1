import type { IntegrationConfig } from '@/types';
import { normalizeProviderPullResponse } from './orchestration';
import type { IntegrationAdapter, ProviderPayload, RemoteRevision } from './types';
import { createRemoteRevisionLabel, simulateLatency } from './helpers';

export const dropboxAdapter: IntegrationAdapter = {
  type: 'dropbox',

  async connect(config: IntegrationConfig) {
    await simulateLatency();
    if (!config.accessToken) {
      throw new Error('Dropbox access token is required to connect.');
    }

    return {
      message: `Connected to Dropbox folder ${config.folderId || '/NovelWriter'}.`,
      syncedAt: Date.now(),
    };
  },

  async testConnection(config: IntegrationConfig) {
    await simulateLatency();
    if (!config.accessToken) {
      throw new Error('Missing Dropbox token. Save your token before testing connection.');
    }

    return {
      message: 'Dropbox token verified and folder is reachable.',
      syncedAt: Date.now(),
    };
  },

  async pull(_config: IntegrationConfig, payload: ProviderPayload) {
    await simulateLatency();
    const remoteDocs = payload.chapters.map((chapter) => ({
      ...chapter,
      updatedAt: Date.now(),
      body: `${chapter.body}\n\nSynced from Dropbox backup.`,
    }));

    return normalizeProviderPullResponse([], remoteDocs, createRemoteRevisionLabel('dropbox-revision'));
  },

  async push(config: IntegrationConfig, payload: ProviderPayload) {
    await simulateLatency();
    if (!config.accessToken) {
      throw new Error('Cannot push to Dropbox without an access token.');
    }

    return {
      message: `Uploaded ${payload.chapters.length} chapter(s) to ${config.folderId || '/NovelWriter'}.`,
      syncedAt: Date.now(),
    };
  },

  async listRemoteRevisions(_config: IntegrationConfig): Promise<RemoteRevision[]> {
    await simulateLatency(250);
    const now = Date.now();
    return [
      { id: createRemoteRevisionLabel('dropbox'), label: 'Dropbox Latest Backup', updatedAt: now },
      { id: `${createRemoteRevisionLabel('dropbox')}-1`, label: 'Dropbox Backup - 1h ago', updatedAt: now - 3600000 },
    ];
  },
};
