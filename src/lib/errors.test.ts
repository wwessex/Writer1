/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/featureFlags', () => ({
  getBrokerBaseUrl: () => '',
  isAIDeveloperModeEnabled: () => false,
  isIntegrationDeveloperModeEnabled: () => false,
}));

vi.mock('@/lib/telemetry', () => ({
  recordTelemetryEvent: vi.fn(),
}));

import {
  createAppError,
  reportAppError,
  getErrorLogs,
  clearErrorLogs,
  setRemoteCrashReporter,
  StorageErrors,
  NetworkErrors,
  ContentErrors,
  isQuotaError,
  storageErrorFrom,
  enableSafeModeForNextRestart,
  consumeSafeModeFlag,
  isSafeModeEnabledForSession,
  initializeSafeModeSession,
} from './errors';

describe('errors', () => {
  beforeEach(() => {
    clearErrorLogs();
    setRemoteCrashReporter(null);
  });

  describe('createAppError', () => {
    it('creates an error with required fields', () => {
      const err = createAppError('TEST_CODE', 'test message', 'application', 'medium');
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('test message');
      expect(err.domain).toBe('application');
      expect(err.severity).toBe('medium');
      expect(err.retryable).toBe(false);
      expect(err.timestamp).toBeGreaterThan(0);
    });

    it('includes optional fields', () => {
      const cause = new Error('root cause');
      const err = createAppError('CODE', 'msg', 'storage', 'critical', {
        cause,
        retryable: true,
        userAction: 'Try again',
      });
      expect(err.retryable).toBe(true);
      expect(err.userAction).toBe('Try again');
      expect(err.cause).toBe(cause);
    });
  });

  describe('reportAppError and getErrorLogs', () => {
    it('stores errors in local logs', async () => {
      const err = createAppError('E1', 'error one', 'application', 'low');
      await reportAppError(err);
      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].error.code).toBe('E1');
    });

    it('sanitizes token-like values in messages', async () => {
      const err = createAppError('E2', 'Bearer abc123secret', 'application', 'low');
      await reportAppError(err);
      const logs = getErrorLogs();
      expect(logs[0].error.message).toContain('[REDACTED]');
      expect(logs[0].error.message).not.toContain('abc123secret');
    });

    it('calls remote crash reporter when set', async () => {
      const reporter = vi.fn();
      setRemoteCrashReporter(reporter);
      const err = createAppError('E3', 'test', 'application', 'medium');
      await reportAppError(err);
      expect(reporter).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearErrorLogs', () => {
    it('empties the log', async () => {
      await reportAppError(createAppError('E', 'm', 'application', 'low'));
      expect(getErrorLogs()).toHaveLength(1);
      clearErrorLogs();
      expect(getErrorLogs()).toHaveLength(0);
    });
  });

  describe('error factories', () => {
    it('StorageErrors.writeFailed returns critical storage error', () => {
      const err = StorageErrors.writeFailed(new Error('disk'));
      expect(err.code).toBe('STORAGE_WRITE_FAILED');
      expect(err.domain).toBe('storage');
      expect(err.severity).toBe('critical');
      expect(err.retryable).toBe(true);
    });

    it('StorageErrors.readFailed returns critical storage error', () => {
      const err = StorageErrors.readFailed();
      expect(err.code).toBe('STORAGE_READ_FAILED');
      expect(err.retryable).toBe(true);
    });

    it('StorageErrors.quotaExceeded is not retryable', () => {
      const err = StorageErrors.quotaExceeded();
      expect(err.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(err.retryable).toBe(false);
    });

    it('NetworkErrors.offline returns medium network error', () => {
      const err = NetworkErrors.offline();
      expect(err.code).toBe('NETWORK_OFFLINE');
      expect(err.domain).toBe('network');
      expect(err.retryable).toBe(true);
    });

    it('NetworkErrors.authExpired includes provider name', () => {
      const err = NetworkErrors.authExpired('Google');
      expect(err.message).toContain('Google');
      expect(err.code).toBe('AUTH_EXPIRED');
    });

    it('ContentErrors.importFailed includes format', () => {
      const err = ContentErrors.importFailed('DOCX');
      expect(err.message).toContain('DOCX');
      expect(err.code).toBe('IMPORT_PARSE_FAILED');
    });

    it('ContentErrors.exportFailed includes format', () => {
      const err = ContentErrors.exportFailed('PDF');
      expect(err.message).toContain('PDF');
    });

    it('ContentErrors.libraryLoadFailed includes lib name', () => {
      const err = ContentErrors.libraryLoadFailed('pdfmake');
      expect(err.message).toContain('pdfmake');
    });
  });

  describe('isQuotaError', () => {
    it('returns true for QuotaExceededError', () => {
      const err = new DOMException('quota', 'QuotaExceededError');
      expect(isQuotaError(err)).toBe(true);
    });

    it('returns false for other errors', () => {
      expect(isQuotaError(new Error('nope'))).toBe(false);
      expect(isQuotaError(null)).toBe(false);
    });
  });

  describe('storageErrorFrom', () => {
    it('returns quota error for QuotaExceededError', () => {
      const err = new DOMException('quota', 'QuotaExceededError');
      expect(storageErrorFrom(err).code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it('returns write failed for other errors', () => {
      expect(storageErrorFrom(new Error('other')).code).toBe('STORAGE_WRITE_FAILED');
    });
  });

  describe('safe mode', () => {
    beforeEach(() => {
      localStorage.removeItem('draftharbour_safe_mode_next_boot');
      delete document.documentElement.dataset.safeMode;
    });

    it('enableSafeModeForNextRestart sets flag', () => {
      enableSafeModeForNextRestart();
      expect(localStorage.getItem('draftharbour_safe_mode_next_boot')).toBe('true');
    });

    it('consumeSafeModeFlag returns true and clears flag', () => {
      enableSafeModeForNextRestart();
      expect(consumeSafeModeFlag()).toBe(true);
      expect(consumeSafeModeFlag()).toBe(false);
    });

    it('isSafeModeEnabledForSession reads dataset', () => {
      expect(isSafeModeEnabledForSession()).toBe(false);
      document.documentElement.dataset.safeMode = 'true';
      expect(isSafeModeEnabledForSession()).toBe(true);
    });

    it('initializeSafeModeSession enables when flag set', () => {
      enableSafeModeForNextRestart();
      const enabled = initializeSafeModeSession();
      expect(enabled).toBe(true);
      expect(document.documentElement.dataset.safeMode).toBe('true');
    });

    it('initializeSafeModeSession disables when no flag', () => {
      const enabled = initializeSafeModeSession();
      expect(enabled).toBe(false);
      expect(document.documentElement.dataset.safeMode).toBe('false');
    });
  });
});
