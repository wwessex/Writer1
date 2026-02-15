import { pluginManager } from '@/lib/plugins';
import type { AppState, IntegrationConfig, IntegrationType } from '@/types';
import { buildPushSyncMetadata } from './sync';
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

  pluginManager.emit('export:before', { provider: type, chapterCount: payload.chapters.length, source: 'sync' });
  pluginManager.emit('sync:export:before', { provider: type, payload });

  const result = await getIntegrationAdapter(type).push(config, payload);

  const remoteRevision = `push-${type}-${result.syncedAt}`;
  const syncedChapters = appState.chapters.map((chapter) => ({
    ...chapter,
    sync: buildPushSyncMetadata(chapter, type, remoteRevision),
  }));

  pluginManager.emit('sync:export:after', {
    provider: type,
    result,
    chapters: syncedChapters,
    remoteRevision,
  });
  pluginManager.emit('export:after', { provider: type, result, source: 'sync' });

  return result;
}

export async function pullIntegrationData(
  type: IntegrationType,
  config: IntegrationConfig,
  appState: Pick<AppState, 'novelId' | 'projectType' | 'chapters'>
): Promise<NormalizedPullResult> {
  const payload = mapAppStateToProviderPayload(appState);

  pluginManager.emit('import:before', { provider: type, chapterCount: payload.chapters.length, source: 'sync' });
  pluginManager.emit('sync:import:before', { provider: type, payload });

  const result = await getIntegrationAdapter(type).pull(config, payload, appState.chapters);

  pluginManager.emit('sync:import:after', {
    provider: type,
    remoteRevision: result.remoteRevision,
    chapterCount: result.chapterUpdates.length,
    conflictCount: result.conflicts.length,
  });
  pluginManager.emit('import:after', { provider: type, result, source: 'sync' });

  return result;
}

export async function listIntegrationRevisions(
  type: IntegrationType,
  config: IntegrationConfig
): Promise<RemoteRevision[]> {
  return getIntegrationAdapter(type).listRemoteRevisions(config);
}
