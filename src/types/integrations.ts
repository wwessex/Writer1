import type { JSONContent } from '@tiptap/core';

// Integration types
export type IntegrationType = 'dropbox' | 'google-drive' | 'scrivener';

export interface IntegrationConfig {
  type: IntegrationType;
  enabled: boolean;
  connectionId?: string;
  providerUserId?: string;
  scopes?: string[];
  expiresAt?: number;
  status?: 'disconnected' | 'pending' | 'connected' | 'error';
  folderId?: string;
  lastSyncAt?: number;
  /** OAuth access token used as Bearer token for provider API calls. */
  sessionToken?: string;
  /** OAuth client ID (Google) or App Key (Dropbox) for PKCE auth flow. */
  clientId?: string;
  /** OAuth refresh token for obtaining new access tokens client-side. */
  refreshToken?: string;
}

export type PersistedIntegrationConfig = Pick<
  IntegrationConfig,
  'type' | 'enabled' | 'connectionId' | 'providerUserId' | 'scopes' | 'expiresAt' | 'status' | 'folderId' | 'lastSyncAt' | 'clientId' | 'refreshToken'
>;

// Conflict resolution
export interface ConflictInfo {
  chapterId: string;
  localVersion: number;
  remoteVersion: number;
  provider?: IntegrationType;
  localRevisionId?: string;
  remoteRevisionId?: string;
  localContent: JSONContent | null;
  remoteContent: JSONContent | null;
  baseContent?: JSONContent | null;
  mergedContent?: JSONContent | null;
  mergeConflictBlocks?: MergeConflictBlock[];
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  resolutionOptions: ConflictResolutionOption[];
}

export interface MergeConflictBlock {
  id: string;
  baseStart: number;
  baseEnd: number;
  mergedStart: number;
  mergedEnd: number;
  localLines: string[];
  remoteLines: string[];
}

export type ConflictResolutionOption = 'local' | 'remote' | 'merge';
