import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing module under test
vi.mock('./availability', () => ({
  isChromeAIAvailable: vi.fn().mockResolvedValue(false),
  isChromeBrowser: vi.fn().mockReturnValue(false),
  detectLocalLlmServer: vi.fn().mockResolvedValue({ available: false }),
}));

vi.mock('./chromeAI', () => {
  const ChromeAIProvider = vi.fn();
  ChromeAIProvider.prototype.type = 'chrome-ai';
  ChromeAIProvider.prototype.isAvailable = vi.fn().mockReturnValue(false);
  ChromeAIProvider.prototype.execute = vi.fn();
  ChromeAIProvider.prototype.destroy = vi.fn();
  return { ChromeAIProvider };
});

vi.mock('./openaiProvider', () => {
  const OpenAIProvider = vi.fn().mockImplementation(function (this: Record<string, unknown>, config: { provider: string }) {
    this.type = config.provider;
    this.isAvailable = () => true;
    this.execute = vi.fn();
    this.destroy = vi.fn();
  });
  return { OpenAIProvider };
});

vi.mock('./serverProxyProvider', () => {
  const ServerProxyProvider = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.type = 'server-proxy';
    this.isAvailable = () => true;
    this.execute = vi.fn();
    this.destroy = vi.fn();
  });
  return { ServerProxyProvider };
});

vi.mock('./customLlmProvider', () => {
  const CustomLlmProvider = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.type = 'custom-llm';
    this.isAvailable = () => true;
    this.execute = vi.fn();
    this.destroy = vi.fn();
    this.supportsStreaming = true;
  });
  return { CustomLlmProvider };
});

vi.mock('./fallbackProvider', () => {
  const FallbackProvider = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.type = 'custom-llm';
    this.isAvailable = () => true;
    this.execute = vi.fn();
    this.destroy = vi.fn();
  });
  return {
    FallbackProvider,
    buildFallbackChain: vi.fn().mockReturnValue(null),
  };
});

vi.mock('@/lib/desktopSecrets', () => ({
  isDesktop: vi.fn().mockReturnValue(false),
  setSecret: vi.fn(),
  deleteSecret: vi.fn(),
  getSecret: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/policy', () => ({
  getManagedPolicy: vi.fn().mockReturnValue({}),
}));

import { loadAIConfig, saveAIConfig, createProvider, detectBestProvider, isChromeWithoutAI, hydrateDesktopSecrets } from './providerManager';
import { getManagedPolicy } from '@/lib/policy';
import { isChromeAIAvailable, isChromeBrowser, detectLocalLlmServer } from './availability';
import { isDesktop, getSecret, setSecret } from '@/lib/desktopSecrets';
import { buildFallbackChain } from './fallbackProvider';

const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

describe('providerManager', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getManagedPolicy).mockReturnValue({});
  });

  describe('loadAIConfig', () => {
    it('returns managed-cloud when no config stored', () => {
      expect(loadAIConfig().provider).toBe('managed-cloud');
    });

    it('returns managed-cloud when AI disabled by policy', () => {
      vi.mocked(getManagedPolicy).mockReturnValue({ disableAIProviders: true });
      mockStorage.set('draftharbour_ai_config', JSON.stringify({ provider: 'openai-compatible' }));
      expect(loadAIConfig().provider).toBe('managed-cloud');
    });

    it('loads stored config', () => {
      mockStorage.set('draftharbour_ai_config', JSON.stringify({
        provider: 'openai-compatible',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        sessionToken: 'sk-test',
      }));
      const config = loadAIConfig();
      expect(config.provider).toBe('openai-compatible');
      expect(config.sessionToken).toBe('sk-test');
    });

    it('migrates legacy endpoint-only format', () => {
      mockStorage.set('draftharbour_ai_config', JSON.stringify({
        endpoint: 'https://test.com',
        model: 'gpt-4o',
      }));
      const config = loadAIConfig();
      expect(config.provider).toBe('openai-compatible');
    });

    it('migrates legacy apiKey to sessionToken', () => {
      mockStorage.set('draftharbour_ai_config', JSON.stringify({
        provider: 'openai-compatible',
        apiKey: 'old-key',
      }));
      expect(loadAIConfig().sessionToken).toBe('old-key');
    });

    it('blocks disabled provider types', () => {
      vi.mocked(getManagedPolicy).mockReturnValue({ disabledAIProviderTypes: ['custom-llm'] });
      mockStorage.set('draftharbour_ai_config', JSON.stringify({
        provider: 'custom-llm',
        customLlm: { backend: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' },
      }));
      expect(loadAIConfig().provider).toBe('managed-cloud');
    });

    it('loads custom-llm config', () => {
      mockStorage.set('draftharbour_ai_config', JSON.stringify({
        provider: 'custom-llm',
        customLlm: { backend: 'ollama', baseUrl: 'http://localhost:11434', model: 'narratryx:latest' },
      }));
      const config = loadAIConfig();
      expect(config.provider).toBe('custom-llm');
      expect(config.customLlm?.backend).toBe('ollama');
    });

    it('handles invalid JSON', () => {
      mockStorage.set('draftharbour_ai_config', 'bad-json');
      expect(loadAIConfig().provider).toBe('managed-cloud');
    });

    it('returns managed-cloud for empty object', () => {
      mockStorage.set('draftharbour_ai_config', JSON.stringify({}));
      expect(loadAIConfig().provider).toBe('managed-cloud');
    });
  });

  describe('saveAIConfig', () => {
    it('saves config to localStorage', () => {
      saveAIConfig({ provider: 'openai-compatible', endpoint: 'https://test.com', sessionToken: 'key' });
      const stored = JSON.parse(mockStorage.get('draftharbour_ai_config')!);
      expect(stored.provider).toBe('openai-compatible');
    });

    it('saves managed-cloud when provider disabled', () => {
      vi.mocked(getManagedPolicy).mockReturnValue({ disabledAIProviderTypes: ['custom-llm'] });
      saveAIConfig({ provider: 'custom-llm' });
      const stored = JSON.parse(mockStorage.get('draftharbour_ai_config')!);
      expect(stored.provider).toBe('managed-cloud');
    });

    it('saves managed-cloud when AI fully disabled', () => {
      vi.mocked(getManagedPolicy).mockReturnValue({ disableAIProviders: true });
      saveAIConfig({ provider: 'openai-compatible' });
      expect(JSON.parse(mockStorage.get('draftharbour_ai_config')!).provider).toBe('managed-cloud');
    });

    it('saves customLlm config', () => {
      saveAIConfig({
        provider: 'custom-llm',
        customLlm: { backend: 'vllm', baseUrl: 'http://localhost:8000', model: 'test', apiKey: 'key' },
      });
      const stored = JSON.parse(mockStorage.get('draftharbour_ai_config')!);
      expect(stored.customLlm.backend).toBe('vllm');
    });
  });

  describe('createProvider', () => {
    it('creates provider for managed-cloud', () => {
      const p = createProvider({ provider: 'managed-cloud' });
      expect(p.type).toBe('managed-cloud');
    });

    it('creates provider for openai-compatible', () => {
      const p = createProvider({ provider: 'openai-compatible' });
      expect(p.type).toBe('openai-compatible');
    });

    it('creates provider for server-proxy', () => {
      const p = createProvider({ provider: 'server-proxy' });
      expect(p.type).toBe('server-proxy');
    });

    it('creates provider for custom-llm', () => {
      vi.mocked(buildFallbackChain).mockReturnValue(null);
      const p = createProvider({
        provider: 'custom-llm',
        customLlm: { backend: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' },
      });
      expect(p.type).toBe('custom-llm');
    });

    it('wraps custom-llm with FallbackProvider when fallback configured', () => {
      vi.mocked(buildFallbackChain).mockReturnValue({
        chain: [{ provider: 'custom-llm' }, { provider: 'managed-cloud' }],
        maxRetriesPerProvider: 2,
        retryBaseDelayMs: 1000,
      });
      const p = createProvider({
        provider: 'custom-llm',
        customLlm: { backend: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', fallbackProvider: 'managed-cloud' },
      });
      expect(p.type).toBe('custom-llm');
    });

    it('falls back for chrome-ai when unavailable', () => {
      const p = createProvider({ provider: 'chrome-ai' });
      expect(p.type).toBe('managed-cloud');
    });

    it('falls back for unknown provider', () => {
      const p = createProvider({ provider: 'unknown' as never });
      expect(p.type).toBe('managed-cloud');
    });
  });

  describe('detectBestProvider', () => {
    it('returns managed-cloud when Chrome AI unavailable and no local server', async () => {
      vi.mocked(isChromeAIAvailable).mockResolvedValue(false);
      vi.mocked(detectLocalLlmServer).mockResolvedValue({ available: false });
      expect(await detectBestProvider()).toBe('managed-cloud');
    });

    it('returns chrome-ai when available', async () => {
      vi.mocked(isChromeAIAvailable).mockResolvedValue(true);
      expect(await detectBestProvider()).toBe('chrome-ai');
    });

    it('returns custom-llm when local server is detected', async () => {
      vi.mocked(isChromeAIAvailable).mockResolvedValue(false);
      vi.mocked(detectLocalLlmServer).mockResolvedValue({
        available: true,
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
      });
      expect(await detectBestProvider()).toBe('custom-llm');
    });
  });

  describe('isChromeWithoutAI', () => {
    it('returns false when not Chrome', () => {
      vi.mocked(isChromeBrowser).mockReturnValue(false);
      expect(isChromeWithoutAI()).toBe(false);
    });
  });

  describe('hydrateDesktopSecrets', () => {
    it('returns config unchanged on non-desktop', async () => {
      vi.mocked(isDesktop).mockReturnValue(false);
      const config = { provider: 'custom-llm' as const, customLlm: { backend: 'ollama' as const, baseUrl: 'http://localhost:11434', model: 'test' } };
      const result = await hydrateDesktopSecrets(config);
      expect(result).toEqual(config);
    });

    it('injects secrets from keychain on desktop', async () => {
      vi.mocked(isDesktop).mockReturnValue(true);
      vi.mocked(getSecret).mockImplementation(async (key: string) => {
        if (key === 'ai_session_token') return 'session-from-keychain';
        if (key === 'custom_llm_api_key') return 'llm-key-from-keychain';
        return null;
      });
      const config = { provider: 'custom-llm' as const, customLlm: { backend: 'ollama' as const, baseUrl: 'http://localhost:11434', model: 'test' } };
      const result = await hydrateDesktopSecrets(config);
      expect(result.sessionToken).toBe('session-from-keychain');
      expect(result.customLlm?.apiKey).toBe('llm-key-from-keychain');
    });

    it('preserves existing keys over keychain', async () => {
      vi.mocked(isDesktop).mockReturnValue(true);
      vi.mocked(getSecret).mockResolvedValue('should-not-override');
      const config = {
        provider: 'custom-llm' as const,
        sessionToken: 'already-set',
        customLlm: { backend: 'ollama' as const, baseUrl: 'http://localhost:11434', model: 'test', apiKey: 'already-set-key' },
      };
      const result = await hydrateDesktopSecrets(config);
      expect(result.sessionToken).toBe('already-set');
      expect(result.customLlm?.apiKey).toBe('already-set-key');
    });
  });

  describe('saveAIConfig stores custom LLM key in keychain', () => {
    it('calls setSecret for custom LLM apiKey on desktop', () => {
      vi.mocked(isDesktop).mockReturnValue(true);
      saveAIConfig({
        provider: 'custom-llm',
        customLlm: { backend: 'ollama', baseUrl: 'http://localhost:11434', model: 'test', apiKey: 'my-secret' },
      });
      expect(setSecret).toHaveBeenCalledWith('custom_llm_api_key', 'my-secret');
    });
  });
});
