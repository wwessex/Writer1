import type { AppState, IntegrationConfig, IntegrationType } from '@/types';
import { dropboxAdapter } from './dropbox';
import { googleDriveAdapter } from './googleDrive';
import { mapAppStateToProviderPayload } from './orchestration';
import { scrivenerAdapter } from './scrivener';
import type { IntegrationAdapter, IntegrationOperationResult, NormalizedPullResult, RemoteRevision } from './types';

const adapters: Record<IntegrationType, IntegrationAdapter> = {
  scrivener: scrivenerAdapter,
  dropbox: dropboxAdapter,
  'google-drive': googleDriveAdapter,
};

export function getIntegrationAdapter(type: IntegrationType): IntegrationAdapter {
  return adapters[type];
}

export async function connectIntegration(
  type: IntegrationType,
  config: IntegrationConfig
): Promise<IntegrationOperationResult> {
  return getIntegrationAdapter(type).connect(config);
}

export async function testIntegrationConnection(
  type: IntegrationType,
  config: IntegrationConfig
): Promise<IntegrationOperationResult> {
  return getIntegrationAdapter(type).testConnection(config);
}

export async function pushIntegrationData(
  type: IntegrationType,
  config: IntegrationConfig,
  appState: Pick<AppState, 'novelId' | 'projectType' | 'chapters'>
): Promise<IntegrationOperationResult> {
  const payload = mapAppStateToProviderPayload(appState);
  return getIntegrationAdapter(type).push(config, payload);
}

export async function pullIntegrationData(
  type: IntegrationType,
  config: IntegrationConfig,
  appState: Pick<AppState, 'novelId' | 'projectType' | 'chapters'>
): Promise<NormalizedPullResult> {
  const payload = mapAppStateToProviderPayload(appState);
  return getIntegrationAdapter(type).pull(config, payload);
}

export async function listIntegrationRevisions(
  type: IntegrationType,
  config: IntegrationConfig
): Promise<RemoteRevision[]> {
  return getIntegrationAdapter(type).listRemoteRevisions(config);
}
