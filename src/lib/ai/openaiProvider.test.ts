import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from './openaiProvider';
import type { AIProviderConfig, AIRequest } from './types';

vi.mock('@/lib/featureFlags', () => ({
  getBrokerBaseUrl: vi.fn(() => ''),
  isAIDeveloperModeEnabled: vi.fn(() => false),
}));

vi.mock('@/lib/integrations/providerClient', () => ({
  fetchEnvelope: vi.fn(),
  fetchWithPolicy: vi.fn(),
}));

vi.mock('@/lib/desktopSecrets', () => ({
  getSecret: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/policy', () => ({
  getManagedPolicy: vi.fn(() => ({ forceLocalOnly: false, disableAIProviders: false })),
}));

import { getBrokerBaseUrl } from '@/lib/featureFlags';
import { fetchWithPolicy } from '@/lib/integrations/providerClient';
import { getManagedPolicy } from '@/lib/policy';

const mockGetBrokerBaseUrl = vi.mocked(getBrokerBaseUrl);
const mockFetchWithPolicy = vi.mocked(fetchWithPolicy);
const mockGetManagedPolicy = vi.mocked(getManagedPolicy);

function makeConfig(overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    provider: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    sessionToken: 'sk-test-key',
    model: 'gpt-4o',
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

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBrokerBaseUrl.mockReturnValue('');
    mockGetManagedPolicy.mockReturnValue({ forceLocalOnly: false, disableAIProviders: false } as ReturnType<typeof getManagedPolicy>);
  });

  describe('isAvailable', () => {
    it('returns true for openai-compatible with endpoint', () => {
      const provider = new OpenAIProvider(makeConfig());
      expect(provider.isAvailable()).toBe(true);
    });

    it('returns false for openai-compatible without endpoint', () => {
      const provider = new OpenAIProvider(makeConfig({ endpoint: '' }));
      expect(provider.isAvailable()).toBe(false);
    });

    it('returns true for managed-cloud when broker URL exists', () => {
      mockGetBrokerBaseUrl.mockReturnValue('https://broker.example.com');
      const provider = new OpenAIProvider(makeConfig({ provider: 'managed-cloud' }));
      expect(provider.isAvailable()).toBe(true);
    });

    it('returns false for managed-cloud when no broker URL', () => {
      const provider = new OpenAIProvider(makeConfig({ provider: 'managed-cloud' }));
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('execute', () => {
    it('throws when policy disables AI', async () => {
      mockGetManagedPolicy.mockReturnValue({ forceLocalOnly: true, disableAIProviders: false } as ReturnType<typeof getManagedPolicy>);
      const provider = new OpenAIProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('disabled by managed policy');
    });

    it('makes OpenAI-compatible request and returns response', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'The story continues...' } }],
        }),
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      const result = await provider.execute(makeRequest());

      expect(result.text).toBe('The story continues...');
      expect(result.provider).toBe('openai-compatible');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('throws on non-ok response', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('API request failed (401)');
    });

    it('throws on malformed response missing choices', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'format' }),
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('Unexpected response format from API');
    });

    it('accepts Anthropic-style response format', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Anthropic response' }],
        }),
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      const result = await provider.execute(makeRequest());
      expect(result.text).toBe('Anthropic response');
    });

    it('accepts simple response field format', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Simple response text',
        }),
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      const result = await provider.execute(makeRequest());
      expect(result.text).toBe('Simple response text');
    });

    it('builds prompt with context for books', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      await provider.execute(makeRequest({ projectType: 'book' }));

      const body = JSON.parse(mockFetchWithPolicy.mock.calls[0][1]!.body as string);
      expect(body.messages[1].content).toContain('chapter');
    });

    it('builds prompt with context for screenplays', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      await provider.execute(makeRequest({ projectType: 'screenplay' }));

      const body = JSON.parse(mockFetchWithPolicy.mock.calls[0][1]!.body as string);
      expect(body.messages[1].content).toContain('scene');
    });

    it('sends prompt without context prefix when context is empty', async () => {
      mockFetchWithPolicy.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      } as Response);

      const provider = new OpenAIProvider(makeConfig());
      await provider.execute(makeRequest({ context: '' }));

      const body = JSON.parse(mockFetchWithPolicy.mock.calls[0][1]!.body as string);
      expect(body.messages[1].content).toBe('Continue the story.');
    });

    it('throws descriptive error when not configured (missing endpoint and key)', async () => {
      const provider = new OpenAIProvider(makeConfig({ endpoint: '', sessionToken: '' }));
      await expect(provider.execute(makeRequest())).rejects.toThrow('not configured');
    });
  });

  describe('metadata', () => {
    it('has correct type', () => {
      const provider = new OpenAIProvider(makeConfig());
      expect(provider.type).toBe('openai-compatible');
    });

    it('destroy is a no-op', () => {
      const provider = new OpenAIProvider(makeConfig());
      expect(() => provider.destroy()).not.toThrow();
    });
  });
});
