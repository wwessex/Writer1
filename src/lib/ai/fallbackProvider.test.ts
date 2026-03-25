import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FallbackProvider, buildFallbackChain } from './fallbackProvider';
import type { AIProvider, AIProviderConfig, AIRequest, AIResponse, FallbackConfig } from './types';

// Mock providerManager to avoid actual provider instantiation
vi.mock('./providerManager', () => ({
  createProvider: vi.fn(),
  loadAIConfig: vi.fn(),
}));
vi.mock('@/lib/featureFlags', () => ({
  getBrokerBaseUrl: vi.fn(),
}));
vi.mock('@/lib/desktopSecrets', () => ({
  isDesktop: vi.fn(),
}));

import { getBrokerBaseUrl } from '@/lib/featureFlags';
import { isDesktop } from '@/lib/desktopSecrets';
import { createProvider, loadAIConfig } from './providerManager';

const mockCreateProvider = vi.mocked(createProvider);
const mockLoadAIConfig = vi.mocked(loadAIConfig);
const mockGetBrokerBaseUrl = vi.mocked(getBrokerBaseUrl);
const mockIsDesktop = vi.mocked(isDesktop);

function makeMockProvider(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    type: 'managed-cloud',
    isAvailable: () => true,
    execute: vi.fn().mockResolvedValue({
      text: 'test response',
      provider: 'managed-cloud',
      latencyMs: 100,
    } as AIResponse),
    destroy: vi.fn(),
    ...overrides,
  };
}

function makeRequest(): AIRequest {
  return {
    action: 'custom',
    prompt: 'test',
    context: '',
    projectType: 'book',
  };
}

describe('FallbackProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAIConfig.mockReturnValue({ provider: 'managed-cloud' });
    mockGetBrokerBaseUrl.mockReturnValue('https://broker.test');
    mockIsDesktop.mockReturnValue(false);
  });

  it('uses first available provider', async () => {
    const primary = makeMockProvider({ type: 'custom-llm' });
    mockCreateProvider.mockReturnValueOnce(primary);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }],
      maxRetriesPerProvider: 2,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    const result = await fallback.execute(makeRequest());

    expect(result.text).toBe('test response');
    expect(primary.execute).toHaveBeenCalledOnce();
  });

  it('falls back to second provider when first fails', async () => {
    const primary = makeMockProvider({
      type: 'custom-llm',
      execute: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const secondary = makeMockProvider({
      type: 'managed-cloud',
      execute: vi.fn().mockResolvedValue({
        text: 'fallback response',
        provider: 'managed-cloud',
        latencyMs: 200,
      }),
    });

    mockCreateProvider
      .mockReturnValueOnce(primary)
      .mockReturnValueOnce(secondary);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }, { provider: 'managed-cloud' }],
      maxRetriesPerProvider: 0,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    const result = await fallback.execute(makeRequest());

    expect(result.text).toBe('fallback response');
  });

  it('skips unavailable providers', async () => {
    const unavailable = makeMockProvider({
      isAvailable: () => false,
    });
    const available = makeMockProvider({
      execute: vi.fn().mockResolvedValue({
        text: 'available response',
        provider: 'managed-cloud',
        latencyMs: 50,
      }),
    });

    mockCreateProvider
      .mockReturnValueOnce(unavailable)
      .mockReturnValueOnce(available);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }, { provider: 'managed-cloud' }],
      maxRetriesPerProvider: 0,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    const result = await fallback.execute(makeRequest());

    expect(result.text).toBe('available response');
    expect(unavailable.execute).not.toHaveBeenCalled();
  });

  it('throws when all providers fail', async () => {
    const provider1 = makeMockProvider({
      execute: vi.fn().mockRejectedValue(new Error('fail 1')),
    });
    const provider2 = makeMockProvider({
      execute: vi.fn().mockRejectedValue(new Error('fail 2')),
    });

    mockCreateProvider
      .mockReturnValueOnce(provider1)
      .mockReturnValueOnce(provider2);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }, { provider: 'managed-cloud' }],
      maxRetriesPerProvider: 0,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    await expect(fallback.execute(makeRequest())).rejects.toThrow('All AI providers failed');
  });

  it('retries before falling back', async () => {
    const primary = makeMockProvider({
      execute: vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          text: 'retry success',
          provider: 'custom-llm',
          latencyMs: 300,
        }),
    });

    mockCreateProvider.mockReturnValueOnce(primary);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }],
      maxRetriesPerProvider: 1,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    const result = await fallback.execute(makeRequest());

    expect(result.text).toBe('retry success');
    expect(primary.execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const primary = makeMockProvider({
      execute: vi.fn().mockRejectedValue(new Error('AI is disabled by managed policy.')),
    });
    const secondary = makeMockProvider();

    mockCreateProvider
      .mockReturnValueOnce(primary)
      .mockReturnValueOnce(secondary);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }, { provider: 'managed-cloud' }],
      maxRetriesPerProvider: 3,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    const result = await fallback.execute(makeRequest());

    // Should have only tried primary once (no retry for policy errors)
    expect(primary.execute).toHaveBeenCalledOnce();
    expect(result.text).toBe('test response');
  });

  it('propagates AbortError immediately', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    const primary = makeMockProvider({
      execute: vi.fn().mockRejectedValue(abortError),
    });

    mockCreateProvider.mockReturnValueOnce(primary);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }],
      maxRetriesPerProvider: 3,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    await expect(fallback.execute(makeRequest())).rejects.toThrow('Aborted');
    expect(primary.execute).toHaveBeenCalledOnce();
  });

  it('destroys all providers', () => {
    const p1 = makeMockProvider();
    const p2 = makeMockProvider();
    mockCreateProvider.mockReturnValueOnce(p1).mockReturnValueOnce(p2);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }, { provider: 'managed-cloud' }],
      maxRetriesPerProvider: 0,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    fallback.destroy();

    expect(p1.destroy).toHaveBeenCalled();
    expect(p2.destroy).toHaveBeenCalled();
  });

  it('isAvailable returns true if any provider is available', () => {
    const unavailable = makeMockProvider({ isAvailable: () => false });
    const available = makeMockProvider({ isAvailable: () => true });
    mockCreateProvider.mockReturnValueOnce(unavailable).mockReturnValueOnce(available);

    const config: FallbackConfig = {
      chain: [{ provider: 'custom-llm' }, { provider: 'managed-cloud' }],
      maxRetriesPerProvider: 0,
      retryBaseDelayMs: 10,
    };

    const fallback = new FallbackProvider(config);
    expect(fallback.isAvailable()).toBe(true);
  });
});

describe('buildFallbackChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAIConfig.mockReturnValue({ provider: 'managed-cloud' });
    mockGetBrokerBaseUrl.mockReturnValue('https://broker.test');
    mockIsDesktop.mockReturnValue(false);
  });

  it('returns null when no fallback configured', () => {
    const config: AIProviderConfig = {
      provider: 'custom-llm',
      customLlm: { backend: 'ollama', baseUrl: 'http://localhost:11434', model: 'test' },
    };
    expect(buildFallbackChain(config)).toBeNull();
  });

  it('builds chain with fallback provider', () => {
    const config: AIProviderConfig = {
      provider: 'custom-llm',
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        fallbackProvider: 'managed-cloud',
      },
    };

    const chain = buildFallbackChain(config);
    expect(chain).not.toBeNull();
    expect(chain!.chain).toHaveLength(2);
    expect(chain!.chain[0].provider).toBe('custom-llm');
    expect(chain!.chain[0].customLlm?.fallbackProvider).toBeUndefined();
    expect(chain!.chain[1]).toEqual({ provider: 'managed-cloud' });
    expect(chain!.maxRetriesPerProvider).toBe(2);
    expect(config.customLlm?.fallbackProvider).toBe('managed-cloud');
  });

  it('creates a non-wrapping primary provider entry for configured fallback', () => {
    const config: AIProviderConfig = {
      provider: 'custom-llm',
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        fallbackProvider: 'managed-cloud',
      },
    };

    const chain = buildFallbackChain(config);
    expect(chain).not.toBeNull();

    mockCreateProvider
      .mockReturnValueOnce(makeMockProvider({ type: 'custom-llm' }))
      .mockReturnValueOnce(makeMockProvider({ type: 'managed-cloud' }));

    new FallbackProvider(chain!);

    expect(mockCreateProvider).toHaveBeenCalledTimes(2);
    expect(mockCreateProvider).toHaveBeenNthCalledWith(1, {
      provider: 'custom-llm',
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
      },
    });
    expect(mockCreateProvider).toHaveBeenNthCalledWith(2, { provider: 'managed-cloud' });
  });

  it('hydrates an openai-compatible fallback into an executable config', () => {
    const config: AIProviderConfig = {
      provider: 'custom-llm',
      endpoint: 'https://api.example.com/v1/chat/completions',
      sessionToken: 'sk-test',
      model: 'gpt-4o-mini',
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        fallbackProvider: 'openai-compatible',
      },
    };

    const chain = buildFallbackChain(config);

    expect(chain).not.toBeNull();
    expect(chain!.chain[1]).toEqual({
      provider: 'openai-compatible',
      endpoint: 'https://api.example.com/v1/chat/completions',
      sessionToken: 'sk-test',
      model: 'gpt-4o-mini',
    });
  });

  it('hydrates an openai-compatible fallback from persisted config when needed', () => {
    mockLoadAIConfig.mockReturnValue({
      provider: 'openai-compatible',
      endpoint: 'https://api.persisted.example/v1/chat/completions',
      sessionToken: 'sk-persisted',
      model: 'gpt-4.1-mini',
    });

    const config: AIProviderConfig = {
      provider: 'custom-llm',
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        fallbackProvider: 'openai-compatible',
      },
    };

    const chain = buildFallbackChain(config);

    expect(chain).not.toBeNull();
    expect(chain!.chain[1]).toEqual({
      provider: 'openai-compatible',
      endpoint: 'https://api.persisted.example/v1/chat/completions',
      sessionToken: 'sk-persisted',
      model: 'gpt-4.1-mini',
    });
  });

  it('hydrates a server-proxy fallback into an executable config', () => {
    const config: AIProviderConfig = {
      provider: 'custom-llm',
      serverProxy: {
        serverProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
        userApiKey: 'groq-key',
      },
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        fallbackProvider: 'server-proxy',
      },
    };

    const chain = buildFallbackChain(config);

    expect(chain).not.toBeNull();
    expect(chain!.chain[1]).toEqual({
      provider: 'server-proxy',
      serverProxy: {
        serverProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
        userApiKey: 'groq-key',
      },
    });
  });

  it('rejects an unconfigured openai-compatible fallback', () => {
    const config: AIProviderConfig = {
      provider: 'custom-llm',
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        fallbackProvider: 'openai-compatible',
      },
    };

    expect(() => buildFallbackChain(config)).toThrow(
      'Custom Provider fallback is not configured. Add an API endpoint in Custom provider (advanced) before selecting it as a fallback.',
    );
  });

  it('rejects an unconfigured server-proxy fallback', () => {
    mockGetBrokerBaseUrl.mockReturnValue('');

    const config: AIProviderConfig = {
      provider: 'custom-llm',
      serverProxy: {
        serverProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
      },
      customLlm: {
        backend: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'test',
        fallbackProvider: 'server-proxy',
      },
    };

    expect(() => buildFallbackChain(config)).toThrow(
      'Server Proxy fallback is not configured. Add an API key or configure a broker URL before selecting it as a fallback.',
    );
  });
});
