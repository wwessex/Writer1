import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerProxyProvider, SERVER_PROXY_ENDPOINTS, SERVER_PROXY_MODELS, SERVER_PROXY_LABELS } from './serverProxyProvider';
import type { AIProviderConfig, AIRequest } from './types';

vi.mock('@/lib/featureFlags', () => ({
  getBrokerBaseUrl: vi.fn(() => ''),
  getBrokerEndpoint: vi.fn((path: string) => `https://broker.test${path}`),
}));

vi.mock('@/lib/integrations/providerClient', () => ({
  fetchEnvelope: vi.fn(),
  fetchWithPolicy: vi.fn(),
}));

vi.mock('@/lib/policy', () => ({
  getManagedPolicy: vi.fn(() => ({ forceLocalOnly: false, disableAIProviders: false })),
}));

import { getBrokerBaseUrl } from '@/lib/featureFlags';
import { fetchEnvelope, fetchWithPolicy } from '@/lib/integrations/providerClient';
import { getManagedPolicy } from '@/lib/policy';

const mockGetBrokerBaseUrl = vi.mocked(getBrokerBaseUrl);
const mockFetchWithPolicy = vi.mocked(fetchWithPolicy);
const mockFetchEnvelope = vi.mocked(fetchEnvelope);
const mockGetManagedPolicy = vi.mocked(getManagedPolicy);

function makeConfig(overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    provider: 'server-proxy',
    serverProxy: {
      serverProvider: 'groq',
      model: 'llama-3.3-70b-versatile',
      userApiKey: 'gsk_testkey123',
    },
    ...overrides,
  };
}

function makeRequest(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    action: 'custom',
    prompt: 'Continue the story.',
    context: 'Once upon a time...',
    projectType: 'book',
    ...overrides,
  };
}

describe('ServerProxyProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBrokerBaseUrl.mockReturnValue('');
    mockGetManagedPolicy.mockReturnValue({ forceLocalOnly: false, disableAIProviders: false } as ReturnType<typeof getManagedPolicy>);
  });

  describe('isAvailable', () => {
    it('returns true when user has API key', () => {
      const provider = new ServerProxyProvider(makeConfig());
      expect(provider.isAvailable()).toBe(true);
    });

    it('returns true when broker URL exists (no user key)', () => {
      mockGetBrokerBaseUrl.mockReturnValue('https://broker.test');
      const provider = new ServerProxyProvider(makeConfig({
        serverProxy: { serverProvider: 'groq', model: 'llama-3.3-70b-versatile' },
      }));
      expect(provider.isAvailable()).toBe(true);
    });

    it('returns false when no key and no broker', () => {
      const provider = new ServerProxyProvider(makeConfig({
        serverProxy: { serverProvider: 'groq', model: 'llama-3.3-70b-versatile' },
      }));
      expect(provider.isAvailable()).toBe(false);
    });

    it('returns false when serverProxy is missing', () => {
      const provider = new ServerProxyProvider({ provider: 'server-proxy' });
      expect(provider.isAvailable()).toBe(false);
    });

    it('returns false when model is missing', () => {
      const provider = new ServerProxyProvider(makeConfig({
        serverProxy: { serverProvider: 'groq', model: '', userApiKey: 'key' },
      }));
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('execute — direct API (Groq/OpenRouter)', () => {
    it('calls Groq API directly with user key', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Groq response' } }],
          usage: { prompt_tokens: 50, completion_tokens: 20 },
        }),
      } as Response);

      const provider = new ServerProxyProvider(makeConfig());
      const result = await provider.execute(makeRequest());

      expect(result.text).toBe('Groq response');
      expect(result.provider).toBe('server-proxy');
      expect(result.usage?.promptTokens).toBe(50);

      const [url] = mockFetchWithPolicy.mock.calls[0];
      expect(url).toBe(SERVER_PROXY_ENDPOINTS.groq);
    });

    it('throws on non-ok response', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limited',
      } as Response);

      const provider = new ServerProxyProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('Groq API error (429)');
    });

    it('throws on malformed response', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'data' }),
      } as Response);

      const provider = new ServerProxyProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('Unexpected response format from Groq');
    });
  });

  describe('execute — Gemini direct', () => {
    it('calls Gemini API with correct format', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
          usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 15 },
        }),
      } as Response);

      const config = makeConfig({
        serverProxy: { serverProvider: 'gemini', model: 'gemini-2.0-flash', userApiKey: 'gemini-key' },
      });
      const provider = new ServerProxyProvider(config);
      const result = await provider.execute(makeRequest());

      expect(result.text).toBe('Gemini response');
      expect(result.usage?.promptTokens).toBe(30);

      const [url] = mockFetchWithPolicy.mock.calls[0];
      expect(url).toContain('gemini-2.0-flash:generateContent');
      expect(url).toContain('key=gemini-key');
    });

    it('throws on malformed Gemini response', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'data' }),
      } as Response);

      const config = makeConfig({
        serverProxy: { serverProvider: 'gemini', model: 'gemini-2.0-flash', userApiKey: 'key' },
      });
      const provider = new ServerProxyProvider(config);
      await expect(provider.execute(makeRequest())).rejects.toThrow('Unexpected response format from Gemini');
    });

    it('throws on Gemini API error', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'API key invalid',
      } as Response);

      const config = makeConfig({
        serverProxy: { serverProvider: 'gemini', model: 'gemini-2.0-flash', userApiKey: 'bad-key' },
      });
      const provider = new ServerProxyProvider(config);
      await expect(provider.execute(makeRequest())).rejects.toThrow('Gemini API error (403)');
    });
  });

  describe('execute — broker proxy', () => {
    it('routes through broker when no user key', async () => {
      mockGetBrokerBaseUrl.mockReturnValue('https://broker.test');
      mockFetchEnvelope.mockResolvedValue({
        ok: true,
        data: { text: 'Broker response', model: 'llama', provider: 'groq' },
      } as never);

      const config = makeConfig({
        serverProxy: { serverProvider: 'groq', model: 'llama-3.3-70b-versatile' },
      });
      const provider = new ServerProxyProvider(config);
      const result = await provider.execute(makeRequest());

      expect(result.text).toBe('Broker response');
      expect(mockFetchEnvelope).toHaveBeenCalled();
    });

    it('throws when no key and no broker', async () => {
      const config = makeConfig({
        serverProxy: { serverProvider: 'groq', model: 'llama-3.3-70b-versatile' },
      });
      const provider = new ServerProxyProvider(config);
      await expect(provider.execute(makeRequest())).rejects.toThrow('No API key provided');
    });
  });

  describe('execute — policy checks', () => {
    it('throws when policy disables AI', async () => {
      mockGetManagedPolicy.mockReturnValue({ forceLocalOnly: false, disableAIProviders: true } as ReturnType<typeof getManagedPolicy>);
      const provider = new ServerProxyProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('disabled by managed policy');
    });

    it('throws when policy forces local only', async () => {
      mockGetManagedPolicy.mockReturnValue({ forceLocalOnly: true, disableAIProviders: false } as ReturnType<typeof getManagedPolicy>);
      const provider = new ServerProxyProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('disabled by managed policy');
    });

    it('throws when server-proxy specifically disabled', async () => {
      mockGetManagedPolicy.mockReturnValue({
        forceLocalOnly: false,
        disableAIProviders: false,
        disabledAIProviderTypes: ['server-proxy'],
      } as ReturnType<typeof getManagedPolicy>);
      const provider = new ServerProxyProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('disabled by managed policy');
    });

    it('throws when serverProxy not configured', async () => {
      const provider = new ServerProxyProvider({ provider: 'server-proxy' });
      await expect(provider.execute(makeRequest())).rejects.toThrow('not configured');
    });
  });

  describe('constants', () => {
    it('exports endpoint URLs for all providers', () => {
      expect(SERVER_PROXY_ENDPOINTS.groq).toContain('groq.com');
      expect(SERVER_PROXY_ENDPOINTS.openrouter).toContain('openrouter.ai');
      expect(SERVER_PROXY_ENDPOINTS.gemini).toContain('googleapis.com');
    });

    it('exports model catalogues for all providers', () => {
      expect(SERVER_PROXY_MODELS.groq.length).toBeGreaterThan(0);
      expect(SERVER_PROXY_MODELS.openrouter.length).toBeGreaterThan(0);
      expect(SERVER_PROXY_MODELS.gemini.length).toBeGreaterThan(0);
    });

    it('exports labels for all providers', () => {
      expect(SERVER_PROXY_LABELS.groq).toBe('Groq');
      expect(SERVER_PROXY_LABELS.openrouter).toBe('OpenRouter');
      expect(SERVER_PROXY_LABELS.gemini).toBe('Google Gemini');
    });
  });

  describe('metadata', () => {
    it('has correct type', () => {
      const provider = new ServerProxyProvider(makeConfig());
      expect(provider.type).toBe('server-proxy');
    });

    it('destroy is a no-op', () => {
      const provider = new ServerProxyProvider(makeConfig());
      expect(() => provider.destroy()).not.toThrow();
    });
  });
});
