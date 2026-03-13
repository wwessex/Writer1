import type { ProgressData } from '@/lib/progressTracker';
import type { Novel, Chapter, Snapshot, Project, Section, ProjectType } from './models';
import type { AppSettings } from './settings';
import type { CommentThread } from './comments';
import type { CharacterEntity, WorldEntry } from './characters';
import type { IntegrationType, PersistedIntegrationConfig } from './integrations';

export interface LegacyBackupData {
  version?: 1 | 2;
  novel: Novel;
  chapters: Chapter[];
  snapshots?: Snapshot[];
  exportedAt: number;
}

export interface BackupDataV3 {
  version: 3;
  projectType: ProjectType;
  project: Project;
  sections: Section[];
  snapshots?: Snapshot[];
  commentThreads?: CommentThread[];
  exportedAt: number;
}

export type BackupData = LegacyBackupData | BackupDataV3;

export interface DhprojManifest {
  format: 'dhproj';
  version: 1;
  appVersion: string;
  createdAt: string;
  exportOptions?: {
    includeSnapshots?: boolean;
    includeIntegrationArtifacts?: boolean;
  };
}

export type DhprojIntegrations = Partial<Record<IntegrationType, PersistedIntegrationConfig>>;

export interface DhprojData {
  manifest: DhprojManifest;
  project: Project;
  projectType: ProjectType;
  sections: Section[];
  snapshots: Snapshot[];
  commentThreads: CommentThread[];
  settings: Partial<AppSettings>;
  goalTrends: unknown[];
  progress?: ProgressData;
  // OAuth/session tokens are intentionally excluded from persisted/imported integration state.
  integrations?: DhprojIntegrations;
  characters?: CharacterEntity[];
  worldEntries?: WorldEntry[];
}
