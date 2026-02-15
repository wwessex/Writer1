import type { IntegrationConfig } from '@/types';
import { normalizeProviderPullResponse } from './orchestration';
import type { IntegrationAdapter, ProviderPayload, RemoteRevision } from './types';
import { createRemoteRevisionLabel, simulateLatency } from './helpers';

export const scrivenerAdapter: IntegrationAdapter = {
  type: 'scrivener',

  async connect(_config: IntegrationConfig) {
    await simulateLatency();
    return {
      message: 'Scrivener workspace ready for transfer.',
      syncedAt: Date.now(),
    };
  },

  async testConnection(_config: IntegrationConfig) {
    await simulateLatency();
    return {
      message: 'Scrivener project bridge is available.',
      syncedAt: Date.now(),
    };
  },

  async pull(_config: IntegrationConfig, payload: ProviderPayload) {
    await simulateLatency();
    const remoteRevision = createRemoteRevisionLabel('scrivener-revision');
    const remoteDocs = payload.chapters.map((chapter) => ({
      ...chapter,
      updatedAt: Date.now(),
      title: `[Scrivener] ${chapter.title}`,
      body: `${chapter.body}\n\nImported from Scrivener sync draft.`,
    }));

    return normalizeProviderPullResponse([], remoteDocs, remoteRevision);
  },

  async push(_config: IntegrationConfig, payload: ProviderPayload) {
    await simulateLatency();
    return {
      message: `Exported ${payload.chapters.length} chapter(s) to Scrivener bundle format.`,
      syncedAt: Date.now(),
    };
  },

  async listRemoteRevisions(_config: IntegrationConfig): Promise<RemoteRevision[]> {
    await simulateLatency(250);
    const now = Date.now();
    return [
      { id: createRemoteRevisionLabel('scrivener'), label: 'Latest Scrivener Draft', updatedAt: now },
      { id: `${createRemoteRevisionLabel('scrivener')}-prev`, label: 'Previous Binder Snapshot', updatedAt: now - 3600000 },
    ];
  },
};
