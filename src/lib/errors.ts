import type { AppErrorInfo, AppState, ErrorDomain, ErrorSeverity } from '@/types';
import {
  getBrokerBaseUrl,
  isAIDeveloperModeEnabled,
  isIntegrationDeveloperModeEnabled
} from '@/lib/featureFlags';
import { recordTelemetryEvent } from '@/lib/telemetry';

import { SAFE_MODE_RESTART_KEY } from '@/lib/constants/storageKeys';

const MAX_LOCAL_ERROR_LOGS = 200;

export type ErrorEventCategory =
  | 'storage_failure'
  | 'sync_conflict'
  | 'integration_auth_failure'
  | 'export_failure'
  | 'import_failure'
  | 'unhandled_rejection'
  | 'global_error'
  | 'react_boundary'
  | 'application';

export interface ErrorEnvironmentMetadata {
  appVersion: string;
  userAgent: string;
  platform: string;
  online: boolean;
  language: string;
  timestamp: number;
  brokerConfigured: boolean;
  featureFlags: {
    integrationsDeveloperMode: boolean;
    aiDeveloperMode: boolean;
  };
  storage: {
    quotaBytes: number | null;
    usedBytes: number | null;
    usageRatio: number | null;
  };
}

export interface ErrorReportEntry {
  id: string;
  category: ErrorEventCategory;
  error: AppErrorInfo;
  metadata: ErrorEnvironmentMetadata;
  context?: string;
}

type RemoteCrashReporter = (entry: ErrorReportEntry) => Promise<void> | void;

let remoteCrashReporter: RemoteCrashReporter | null = null;
const localErrorLogs: ErrorReportEntry[] = [];

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeString(raw: string): string {
  return raw
    .replace(/(bearer\s+)[a-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/(api[_-]?key["'=: ]+)[^\s"']+/gi, '$1[REDACTED]')
    .replace(/(token["'=: ]+)[^\s"']+/gi, '$1[REDACTED]');
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) return value.map(sanitizeUnknown);

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('auth')) {
        next[key] = '[REDACTED]';
      } else {
        next[key] = sanitizeUnknown(val);
      }
    }
    return next;
  }

  return value;
}

async function getStorageMetadata(): Promise<ErrorEnvironmentMetadata['storage']> {
  if (!navigator.storage?.estimate) {
    return { quotaBytes: null, usedBytes: null, usageRatio: null };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const quotaBytes = typeof estimate.quota === 'number' ? estimate.quota : null;
    const usedBytes = typeof estimate.usage === 'number' ? estimate.usage : null;
    const usageRatio = quotaBytes && usedBytes ? Number((usedBytes / quotaBytes).toFixed(4)) : null;
    return { quotaBytes, usedBytes, usageRatio };
  } catch {
    return { quotaBytes: null, usedBytes: null, usageRatio: null };
  }
}

const cachedStaticMetadata = {
  appVersion: import.meta.env.VITE_APP_VERSION || '2.0.0',
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  platform: typeof navigator !== 'undefined' ? (navigator.platform || 'unknown') : 'unknown',
  language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
  brokerConfigured: Boolean(getBrokerBaseUrl()),
  featureFlags: {
    integrationsDeveloperMode: isIntegrationDeveloperModeEnabled(),
    aiDeveloperMode: isAIDeveloperModeEnabled(),
  },
};

export async function collectEnvironmentMetadata(): Promise<ErrorEnvironmentMetadata> {
  return {
    ...cachedStaticMetadata,
    online: navigator.onLine,
    timestamp: Date.now(),
    storage: await getStorageMetadata(),
  };
}

export function setRemoteCrashReporter(reporter: RemoteCrashReporter | null): void {
  remoteCrashReporter = reporter;
}

export async function reportAppError(
  error: AppErrorInfo,
  options?: {
    category?: ErrorEventCategory;
    context?: string;
  }
): Promise<void> {
  const category = options?.category || 'application';
  const metadata = await collectEnvironmentMetadata();

  const entry: ErrorReportEntry = {
    id: generateErrorId(),
    category,
    error: {
      ...error,
      message: sanitizeString(error.message),
      cause: sanitizeUnknown(error.cause),
    },
    metadata,
    context: options?.context ? sanitizeString(options.context) : undefined,
  };

  localErrorLogs.unshift(entry);
  if (localErrorLogs.length > MAX_LOCAL_ERROR_LOGS) {
    localErrorLogs.length = MAX_LOCAL_ERROR_LOGS;
  }

  recordTelemetryEvent({
    action: `error.${category}.${error.code.toLowerCase()}`,
    contextLengthChars: options?.context?.length || 0,
    promptLengthChars: 0,
    responseLengthChars: 0,
    success: false,
    errorType: error.code,
  });

  if (remoteCrashReporter) {
    try {
      await remoteCrashReporter(entry);
    } catch (remoteError) {
      console.error('[errors] remote crash reporter failed', remoteError);
    }
  }
}

export function getErrorLogs(): ErrorReportEntry[] {
  return [...localErrorLogs];
}

export function clearErrorLogs(): void {
  localErrorLogs.length = 0;
}

export async function createDiagnosticsReport(state: AppState): Promise<string> {
  const metadata = await collectEnvironmentMetadata();

  const report = {
    generatedAt: new Date().toISOString(),
    metadata,
    appStateSummary: {
      projectType: state.projectType,
      novelId: state.novelId,
      novelTitle: sanitizeString(state.novelTitle),
      chapterCount: state.chapters.length,
      activeChapterId: state.activeChapterId,
      totalScenes: state.chapters.reduce((sum, chapter) => sum + (chapter.scenes?.length || 0), 0),
      isOnline: state.isOnline,
      isSaving: state.isSaving,
      settings: {
        theme: state.settings.theme,
        autosaveMs: state.settings.autosaveMs,
        focusMode: state.settings.focusMode,
        typewriterMode: state.settings.typewriterMode,
        languageToolEnabled: state.settings.assist.languageToolEnabled,
        syncEnabled: Boolean(state.settings.sync.url),
      },
    },
    recentErrors: getErrorLogs(),
    redaction: [
      'Tokens, secrets, auth headers, and password-like fields are replaced with [REDACTED].',
      'Diagnostics include metadata and aggregate state only; chapter/editor content is excluded.',
    ],
  };

  return JSON.stringify(report, null, 2);
}

export function enableSafeModeForNextRestart(): void {
  localStorage.setItem(SAFE_MODE_RESTART_KEY, 'true');
}

export function consumeSafeModeFlag(): boolean {
  const enabled = localStorage.getItem(SAFE_MODE_RESTART_KEY) === 'true';
  if (enabled) localStorage.removeItem(SAFE_MODE_RESTART_KEY);
  return enabled;
}

export function isSafeModeEnabledForSession(): boolean {
  return document.documentElement.dataset.safeMode === 'true';
}

export function initializeSafeModeSession(): boolean {
  const shouldEnable = consumeSafeModeFlag();
  document.documentElement.dataset.safeMode = shouldEnable ? 'true' : 'false';
  return shouldEnable;
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    void reportAppError(
      createAppError('UNHANDLED_REJECTION', 'Unhandled promise rejection', 'application', 'high', { cause: reason }),
      { category: 'unhandled_rejection' }
    );
  });

  window.addEventListener('error', event => {
    void reportAppError(
      createAppError('GLOBAL_ERROR', event.message || 'Unexpected global error', 'application', 'high', { cause: event.error }),
      { category: 'global_error' }
    );
  });
}

export function createAppError(
  code: string,
  message: string,
  domain: ErrorDomain,
  severity: ErrorSeverity,
  options?: {
    cause?: unknown;
    retryable?: boolean;
    userAction?: string;
  }
): AppErrorInfo {
  return {
    code,
    message,
    domain,
    severity,
    cause: options?.cause,
    retryable: options?.retryable ?? false,
    userAction: options?.userAction,
    timestamp: Date.now(),
  };
}

export const StorageErrors = {
  writeFailed: (cause?: unknown) => createAppError(
    'STORAGE_WRITE_FAILED',
    'Failed to save your changes.',
    'storage', 'critical',
    { cause, retryable: true, userAction: 'Your work may not be saved. Try again or export a backup.' }
  ),
  readFailed: (cause?: unknown) => createAppError(
    'STORAGE_READ_FAILED',
    'Failed to load data from storage.',
    'storage', 'critical',
    { cause, retryable: true, userAction: 'Try reloading the page.' }
  ),
  quotaExceeded: (cause?: unknown) => createAppError(
    'STORAGE_QUOTA_EXCEEDED',
    'Storage is full.',
    'storage', 'critical',
    { cause, retryable: false, userAction: 'Export a backup and clear old projects to free space.' }
  ),
};

export const NetworkErrors = {
  offline: () => createAppError(
    'NETWORK_OFFLINE',
    'You are offline.',
    'network', 'medium',
    { retryable: true, userAction: 'Changes are saved locally. Sync will resume when you reconnect.' }
  ),
  authExpired: (provider: string) => createAppError(
    'AUTH_EXPIRED',
    `${provider} session expired.`,
    'network', 'medium',
    { retryable: false, userAction: 'Reconnect in Integrations settings.' }
  ),
};

export const ContentErrors = {
  importFailed: (format: string, cause?: unknown) => createAppError(
    'IMPORT_PARSE_FAILED',
    `Failed to parse ${format} file.`,
    'content', 'medium',
    { cause, retryable: false, userAction: 'Check that the file is valid and try again.' }
  ),
  exportFailed: (format: string, cause?: unknown) => createAppError(
    'EXPORT_FAILED',
    `${format} export failed.`,
    'content', 'medium',
    { cause, retryable: true, userAction: 'Please try again.' }
  ),
  libraryLoadFailed: (lib: string, cause?: unknown) => createAppError(
    'LIBRARY_LOAD_FAILED',
    `Failed to load the ${lib} library.`,
    'content', 'medium',
    { cause, retryable: true, userAction: 'Check your connection and try again.' }
  ),
};

export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (
    err.name === 'QuotaExceededError' ||
    err.code === 22
  );
}

export function storageErrorFrom(cause: unknown): AppErrorInfo {
  return isQuotaError(cause)
    ? StorageErrors.quotaExceeded(cause)
    : StorageErrors.writeFailed(cause);
}

export function recordAppError(error: AppErrorInfo): void {
  void reportAppError(error);
}
