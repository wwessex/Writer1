import type { AppSettings } from '@/types';

export interface ManagedPolicy {
  forceLocalOnly?: boolean;
  disableTelemetry?: boolean;
  disableAIProviders?: boolean;
  disabledAIProviderTypes?: Array<'chrome-ai' | 'managed-cloud' | 'openai-compatible' | 'server-proxy' | 'custom-llm'>;
  settingsOverrides?: Partial<AppSettings>;
}

const POLICY_STORAGE_KEY = 'draftharbour_managed_policy_v1';

function readPolicyFromWindow(): ManagedPolicy | null {
  const candidate = (window as Window & { __DH_MANAGED_POLICY__?: ManagedPolicy }).__DH_MANAGED_POLICY__;
  return candidate ?? null;
}

function readPolicyFromStorage(): ManagedPolicy | null {
  try {
    const raw = localStorage.getItem(POLICY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ManagedPolicy;
  } catch {
    return null;
  }
}

export function getManagedPolicy(): ManagedPolicy {
  return readPolicyFromWindow() ?? readPolicyFromStorage() ?? {};
}

export function applyManagedSettingsOverrides(settings: AppSettings): AppSettings {
  const policy = getManagedPolicy();
  const overridden = policy.settingsOverrides ? { ...settings, ...policy.settingsOverrides } : settings;

  if (policy.forceLocalOnly) {
    return {
      ...overridden,
      sync: { ...overridden.sync, url: '', auth: '' }
    };
  }

  return overridden;
}

export function persistManagedPolicy(policy: ManagedPolicy): void {
  localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
}
