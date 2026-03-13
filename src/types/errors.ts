// ── Error handling types ──

/** Domains that errors belong to, for categorization and UI treatment. */
export type ErrorDomain =
  | 'storage'
  | 'network'
  | 'content'
  | 'ai'
  | 'application';

/** Severity determines UI treatment: how prominently and persistently to show. */
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Structured application error.
 * Extends native Error concept with domain, severity, and recovery metadata.
 */
export interface AppErrorInfo {
  /** Unique error code for programmatic handling (e.g. 'STORAGE_WRITE_FAILED'). */
  code: string;
  /** Human-readable message safe to show the user. */
  message: string;
  /** Which subsystem produced the error. */
  domain: ErrorDomain;
  /** How severe — drives toast persistence and UI treatment. */
  severity: ErrorSeverity;
  /** The original error, if wrapping a caught exception. */
  cause?: unknown;
  /** Whether automatic retry is possible. */
  retryable: boolean;
  /** Suggested user action (shown in toast or error panel). */
  userAction?: string;
  /** Timestamp of occurrence. */
  timestamp: number;
}
