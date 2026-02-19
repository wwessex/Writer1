import type { AppErrorInfo, ErrorDomain, ErrorSeverity } from '@/types';
import { recordTelemetryEvent } from '@/lib/telemetry';

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

// ── Storage errors ──

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

// ── Network / integration errors ──

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

// ── Content / export / import errors ──

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

/** Check if a caught error is an IndexedDB quota exceeded error. */
export function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (
    err.name === 'QuotaExceededError' ||
    err.code === 22
  );
}

/** Build the appropriate storage AppErrorInfo for a caught error. */
export function storageErrorFrom(cause: unknown): AppErrorInfo {
  return isQuotaError(cause)
    ? StorageErrors.quotaExceeded(cause)
    : StorageErrors.writeFailed(cause);
}

/** Record an AppErrorInfo to the telemetry system. */
export function recordAppError(error: AppErrorInfo): void {
  recordTelemetryEvent({
    action: `error.${error.domain}.${error.code.toLowerCase()}`,
    contextLengthChars: 0,
    promptLengthChars: 0,
    responseLengthChars: 0,
    success: false,
    errorType: error.code,
  });
}
