import type { Chapter, IntegrationConfig } from '@/types';
import { googleDriveDirectAdapter } from './googleDriveDirect';
import type { IntegrationAdapter, ProviderPayload, RemoteRevision } from './types';

export const googleDriveAdapter: IntegrationAdapter = {
  type: 'google-drive',

  async connect(config: IntegrationConfig) {
    return googleDriveDirectAdapter.connect(config);
  },

  async testConnection(config: IntegrationConfig) {
    return googleDriveDirectAdapter.testConnection(config);
  },

  async pull(config: IntegrationConfig, payload: ProviderPayload, localChapters: Chapter[]) {
    return googleDriveDirectAdapter.pull(config, payload, localChapters);
  },

  async push(config: IntegrationConfig, payload: ProviderPayload) {
    return googleDriveDirectAdapter.push(config, payload);
  },

  async listRemoteRevisions(config: IntegrationConfig): Promise<RemoteRevision[]> {
    return googleDriveDirectAdapter.listRemoteRevisions(config);
  },
};
