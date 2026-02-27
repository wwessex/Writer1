import type { Chapter, IntegrationConfig } from '@/types';
import { dropboxDirectAdapter } from './dropboxDirect';
import type { IntegrationAdapter, ProviderPayload, RemoteRevision } from './types';

export const dropboxAdapter: IntegrationAdapter = {
  type: 'dropbox',

  async connect(config: IntegrationConfig) {
    return dropboxDirectAdapter.connect(config);
  },

  async testConnection(config: IntegrationConfig) {
    return dropboxDirectAdapter.testConnection(config);
  },

  async pull(config: IntegrationConfig, payload: ProviderPayload, localChapters: Chapter[]) {
    return dropboxDirectAdapter.pull(config, payload, localChapters);
  },

  async push(config: IntegrationConfig, payload: ProviderPayload) {
    return dropboxDirectAdapter.push(config, payload);
  },

  async listRemoteRevisions(config: IntegrationConfig): Promise<RemoteRevision[]> {
    return dropboxDirectAdapter.listRemoteRevisions(config);
  },
};
