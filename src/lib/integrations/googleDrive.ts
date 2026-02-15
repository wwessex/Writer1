import type { Chapter, IntegrationConfig } from '@/types';
import { normalizeProviderPullResponse } from './orchestration';
import type { IntegrationAdapter, ProviderPayload, RemoteRevision } from './types';
import { createRemoteRevisionLabel, simulateLatency } from './helpers';

export const googleDriveAdapter: IntegrationAdapter = {
  type: 'google-drive',

  async connect(_config: IntegrationConfig) {
    await simulateLatency();
    return {
      message: 'Google Drive OAuth handshake simulated in local mode.',
      syncedAt: Date.now(),
    };
  },

  async testConnection(_config: IntegrationConfig) {
    await simulateLatency();
    return {
      message: 'Google Drive API bridge is reachable (mock provider).',
      syncedAt: Date.now(),
    };
  },

  async pull(_config: IntegrationConfig, payload: ProviderPayload, localChapters: Chapter[]) {
    await simulateLatency();
    const remoteDocs = payload.chapters.map((chapter) => ({
      ...chapter,
      updatedAt: Date.now(),
      title: `${chapter.title} (Drive)`
    }));

    return normalizeProviderPullResponse(
      localChapters,
      remoteDocs,
      createRemoteRevisionLabel('gdrive-revision')
    );
  },

  async push(_config: IntegrationConfig, payload: ProviderPayload) {
    await simulateLatency();
    return {
      message: `Pushed ${payload.chapters.length} chapter(s) to Google Drive docs.`,
      syncedAt: Date.now(),
    };
  },

  async listRemoteRevisions(_config: IntegrationConfig): Promise<RemoteRevision[]> {
    await simulateLatency(250);
    const now = Date.now();
    return [
      { id: createRemoteRevisionLabel('gdrive'), label: 'Drive Revision A', updatedAt: now },
      { id: `${createRemoteRevisionLabel('gdrive')}-1`, label: 'Drive Revision B', updatedAt: now - 5400000 },
    ];
  },
};
