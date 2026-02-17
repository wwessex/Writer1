import type { Chapter, IntegrationConfig } from '@/types';
import { isIntegrationDeveloperModeEnabled } from '@/lib/featureFlags';
import { brokerConnect, brokerPull, brokerPush } from './brokerClient';
import { dropboxDirectAdapter } from './dropboxDirect';
import type { IntegrationAdapter, ProviderPayload, RemoteRevision } from './types';

export const dropboxAdapter: IntegrationAdapter = {
  type: 'dropbox',

  async connect(config: IntegrationConfig) {
    if (isIntegrationDeveloperModeEnabled()) {
      return dropboxDirectAdapter.connect(config);
    }
    return brokerConnect('dropbox', config);
  },

  async testConnection(config: IntegrationConfig) {
    if (isIntegrationDeveloperModeEnabled()) {
      return dropboxDirectAdapter.testConnection(config);
    }
    return brokerConnect('dropbox', config);
  },

  async pull(config: IntegrationConfig, payload: ProviderPayload, localChapters: Chapter[]) {
    if (isIntegrationDeveloperModeEnabled()) {
      return dropboxDirectAdapter.pull(config, payload, localChapters);
    }
    return brokerPull('dropbox', config, payload, localChapters);
  },

  async push(config: IntegrationConfig, payload: ProviderPayload) {
    if (isIntegrationDeveloperModeEnabled()) {
      return dropboxDirectAdapter.push(config, payload);
    }
    return brokerPush('dropbox', config, payload);
  },

  async listRemoteRevisions(config: IntegrationConfig): Promise<RemoteRevision[]> {
    return dropboxDirectAdapter.listRemoteRevisions(config);
  },
};
