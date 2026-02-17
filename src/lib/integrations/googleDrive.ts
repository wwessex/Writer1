import type { Chapter, IntegrationConfig } from '@/types';
import { isIntegrationDeveloperModeEnabled } from '@/lib/featureFlags';
import { brokerConnect, brokerPull, brokerPush } from './brokerClient';
import { googleDriveDirectAdapter } from './googleDriveDirect';
import type { IntegrationAdapter, ProviderPayload, RemoteRevision } from './types';

export const googleDriveAdapter: IntegrationAdapter = {
  type: 'google-drive',

  async connect(config: IntegrationConfig) {
    if (isIntegrationDeveloperModeEnabled()) {
      return googleDriveDirectAdapter.connect(config);
    }
    return brokerConnect('google-drive', config);
  },

  async testConnection(config: IntegrationConfig) {
    if (isIntegrationDeveloperModeEnabled()) {
      return googleDriveDirectAdapter.testConnection(config);
    }
    return brokerConnect('google-drive', config);
  },

  async pull(config: IntegrationConfig, payload: ProviderPayload, localChapters: Chapter[]) {
    if (isIntegrationDeveloperModeEnabled()) {
      return googleDriveDirectAdapter.pull(config, payload, localChapters);
    }
    return brokerPull('google-drive', config, payload, localChapters);
  },

  async push(config: IntegrationConfig, payload: ProviderPayload) {
    if (isIntegrationDeveloperModeEnabled()) {
      return googleDriveDirectAdapter.push(config, payload);
    }
    return brokerPush('google-drive', config, payload);
  },

  async listRemoteRevisions(config: IntegrationConfig): Promise<RemoteRevision[]> {
    // Keep revisions browser-direct for now to preserve existing behavior.
    return googleDriveDirectAdapter.listRemoteRevisions(config);
  },
};
