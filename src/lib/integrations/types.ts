import type { AppState, Chapter, ConflictInfo, IntegrationConfig, IntegrationType, ProjectType } from '@/types';

export interface ProviderDocument {
  id: string;
  title: string;
  body: string;
  order: number;
  updatedAt: number;
}

export interface ProviderPayload {
  novelId: string;
  projectType: ProjectType;
  chapters: ProviderDocument[];
}

export interface NormalizedPullResult {
  chapterUpdates: Chapter[];
  remoteRevision: string;
  conflicts: ConflictInfo[];
}

export interface RemoteRevision {
  id: string;
  label: string;
  updatedAt: number;
}

export interface IntegrationOperationResult {
  message: string;
  syncedAt: number;
}

export interface IntegrationAdapter {
  readonly type: IntegrationType;
  connect(config: IntegrationConfig): Promise<IntegrationOperationResult>;
  testConnection(config: IntegrationConfig): Promise<IntegrationOperationResult>;
  pull(config: IntegrationConfig, payload: ProviderPayload, localChapters: Chapter[]): Promise<NormalizedPullResult>;
  push(config: IntegrationConfig, payload: ProviderPayload): Promise<IntegrationOperationResult>;
  listRemoteRevisions(config: IntegrationConfig): Promise<RemoteRevision[]>;
}

export interface IntegrationRunContext {
  appState: Pick<AppState, 'novelId' | 'projectType' | 'chapters'>;
}
