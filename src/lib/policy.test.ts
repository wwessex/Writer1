import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getManagedPolicy, applyManagedSettingsOverrides, persistManagedPolicy } from './policy';
import type { ManagedPolicy } from './policy';
import type { AppSettings } from '@/types';

const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

// Reset window policy between tests
const windowObj = window as Window & { __DH_MANAGED_POLICY__?: ManagedPolicy };

describe('policy', () => {
  beforeEach(() => {
    mockStorage.clear();
    delete windowObj.__DH_MANAGED_POLICY__;
  });

  describe('getManagedPolicy', () => {
    it('returns empty object when no policy set', () => {
      const policy = getManagedPolicy();
      expect(policy).toEqual({});
    });

    it('reads policy from window global', () => {
      windowObj.__DH_MANAGED_POLICY__ = { forceLocalOnly: true };
      const policy = getManagedPolicy();
      expect(policy.forceLocalOnly).toBe(true);
    });

    it('reads policy from localStorage', () => {
      mockStorage.set('draftharbour_managed_policy_v1', JSON.stringify({
        disableAIProviders: true,
      }));
      const policy = getManagedPolicy();
      expect(policy.disableAIProviders).toBe(true);
    });

    it('window policy takes precedence over localStorage', () => {
      windowObj.__DH_MANAGED_POLICY__ = { forceLocalOnly: true };
      mockStorage.set('draftharbour_managed_policy_v1', JSON.stringify({
        forceLocalOnly: false,
      }));
      const policy = getManagedPolicy();
      expect(policy.forceLocalOnly).toBe(true);
    });

    it('handles invalid JSON in localStorage', () => {
      mockStorage.set('draftharbour_managed_policy_v1', 'not-json');
      const policy = getManagedPolicy();
      expect(policy).toEqual({});
    });

    it('supports disabledAIProviderTypes with custom-llm', () => {
      mockStorage.set('draftharbour_managed_policy_v1', JSON.stringify({
        disabledAIProviderTypes: ['custom-llm', 'server-proxy'],
      }));
      const policy = getManagedPolicy();
      expect(policy.disabledAIProviderTypes).toContain('custom-llm');
      expect(policy.disabledAIProviderTypes).toContain('server-proxy');
    });
  });

  describe('persistManagedPolicy', () => {
    it('saves policy to localStorage', () => {
      persistManagedPolicy({ disableAIProviders: true });
      const stored = JSON.parse(mockStorage.get('draftharbour_managed_policy_v1')!);
      expect(stored.disableAIProviders).toBe(true);
    });

    it('saves policy with custom-llm in disabled types', () => {
      persistManagedPolicy({
        disabledAIProviderTypes: ['custom-llm'],
      });
      const stored = JSON.parse(mockStorage.get('draftharbour_managed_policy_v1')!);
      expect(stored.disabledAIProviderTypes).toContain('custom-llm');
    });
  });

  describe('applyManagedSettingsOverrides', () => {
    it('returns settings unchanged when no policy', () => {
      const settings = { theme: 'light' } as unknown as AppSettings;
      const result = applyManagedSettingsOverrides(settings);
      expect(result.theme).toBe('light');
    });

    it('applies settings overrides from policy', () => {
      windowObj.__DH_MANAGED_POLICY__ = {
        settingsOverrides: { theme: 'dark' } as Partial<AppSettings>,
      };
      const settings = { theme: 'light' } as unknown as AppSettings;
      const result = applyManagedSettingsOverrides(settings);
      expect(result.theme).toBe('dark');
    });

    it('clears sync config when forceLocalOnly', () => {
      windowObj.__DH_MANAGED_POLICY__ = { forceLocalOnly: true };
      const settings = { sync: { url: 'https://sync.example.com', auth: 'token' } } as unknown as AppSettings;
      const result = applyManagedSettingsOverrides(settings);
      expect(result.sync.url).toBe('');
      expect(result.sync.auth).toBe('');
    });
  });
});
