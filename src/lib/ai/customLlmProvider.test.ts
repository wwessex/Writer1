import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomLlmProvider, CUSTOM_LLM_DEFAULTS, CUSTOM_LLM_BACKEND_LABELS } from './customLlmProvider';
import type { AIProviderConfig, AIRequest } from './types';

// Mock fetchWithPolicy
vi.mock('@/lib/integrations/providerClient', () => ({
  fetchWithPolicy: vi.fn(),
}));

import { fetchWithPolicy } from '@/lib/integrations/providerClient';

const mockFetch = vi.mocked(fetchWithPolicy);

function makeConfig(overrides: Partial<AIProviderConfig['customLlm']> = {}): AIProviderConfig {
  return {
    provider: 'custom-llm',
    customLlm: {
      backend: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'narratryx:latest',
      streaming: false,
      ...overrides,
    },
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

describe('CustomLlmProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns true when baseUrl and model are set', () => {
      const provider = new CustomLlmProvider(makeConfig());
      expect(provider.isAvailable()).toBe(true);
    });

    it('returns false when baseUrl is empty', () => {
      const provider = new CustomLlmProvider(makeConfig({ baseUrl: '' }));
      expect(provider.isAvailable()).toBe(false);
    });

    it('returns false when model is empty', () => {
      const provider = new CustomLlmProvider(makeConfig({ model: '' }));
      expect(provider.isAvailable()).toBe(false);
    });

    it('returns false when customLlm is undefined', () => {
      const provider = new CustomLlmProvider({ provider: 'custom-llm' });
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('execute (non-streaming)', () => {
    it('calls Ollama API with correct format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { content: 'The dragon appeared.' },
          prompt_eval_count: 50,
          eval_count: 20,
        }),
      } as Response);

      const provider = new CustomLlmProvider(makeConfig());
      const result = await provider.execute(makeRequest());

      expect(result.text).toBe('The dragon appeared.');
      expect(result.provider).toBe('custom-llm');
      expect(result.streamed).toBe(false);
      expect(result.usage?.promptTokens).toBe(50);
      expect(result.usage?.completionTokens).toBe(20);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/chat');
      const body = JSON.parse(options!.body as string);
      expect(body.model).toBe('narratryx:latest');
      expect(body.stream).toBe(false);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
    });

    it('calls vLLM API with OpenAI-compatible format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'A shadowy figure emerged.' } }],
          usage: { prompt_tokens: 100, completion_tokens: 30 },
        }),
      } as Response);

      const config = makeConfig({ backend: 'vllm', baseUrl: 'http://localhost:8000' });
      const provider = new CustomLlmProvider(config);
      const result = await provider.execute(makeRequest());

      expect(result.text).toBe('A shadowy figure emerged.');
      expect(result.usage?.promptTokens).toBe(100);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8000/v1/chat/completions');
    });

    it('calls llama.cpp API correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from llama.cpp' } }],
        }),
      } as Response);

      const config = makeConfig({ backend: 'llama-cpp', baseUrl: 'http://localhost:8080' });
      const provider = new CustomLlmProvider(config);
      const result = await provider.execute(makeRequest());

      expect(result.text).toBe('Hello from llama.cpp');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8080/v1/chat/completions');
    });

    it('throws on unconfigured provider', async () => {
      const provider = new CustomLlmProvider({ provider: 'custom-llm' });
      await expect(provider.execute(makeRequest())).rejects.toThrow('not configured');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      } as Response);

      const provider = new CustomLlmProvider(makeConfig());
      await expect(provider.execute(makeRequest())).rejects.toThrow('Ollama error (500)');
    });

    it('includes API key in headers when configured', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'ok' } }),
      } as Response);

      const config = makeConfig({ apiKey: 'test-key-123' });
      const provider = new CustomLlmProvider(config);
      await provider.execute(makeRequest());

      const [, options] = mockFetch.mock.calls[0];
      expect(options!.headers).toEqual(expect.objectContaining({
        Authorization: 'Bearer test-key-123',
      }));
    });

    it('respects custom temperature and maxTokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'ok' } }),
      } as Response);

      const config = makeConfig({ temperature: 0.3, maxTokens: 4096 });
      const provider = new CustomLlmProvider(config);
      await provider.execute(makeRequest());

      const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
      expect(body.options.temperature).toBe(0.3);
      expect(body.options.num_predict).toBe(4096);
    });

    it('includes story bible context in prompt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'ok' } }),
      } as Response);

      const provider = new CustomLlmProvider(makeConfig());
      await provider.execute(makeRequest({
        storyBibleContext: {
          entities: [
            { name: 'Sarah', type: 'character', description: 'Protagonist, age 30', triggerKeywords: ['sarah'] },
          ],
          recentSceneSummaries: ['Sarah discovers the letter'],
          styleNotes: 'Gothic tone',
        },
      }));

      const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
      const userMessage = body.messages[1].content;
      expect(userMessage).toContain('Sarah');
      expect(userMessage).toContain('Gothic tone');
      expect(userMessage).toContain('discovers the letter');
    });
  });

  describe('type and metadata', () => {
    it('has correct type', () => {
      const provider = new CustomLlmProvider(makeConfig());
      expect(provider.type).toBe('custom-llm');
    });

    it('supports streaming', () => {
      const provider = new CustomLlmProvider(makeConfig());
      expect(provider.supportsStreaming).toBe(true);
    });

    it('destroy is a no-op', () => {
      const provider = new CustomLlmProvider(makeConfig());
      expect(() => provider.destroy()).not.toThrow();
    });
  });
});

describe('CUSTOM_LLM_DEFAULTS', () => {
  it('has defaults for all backends', () => {
    expect(CUSTOM_LLM_DEFAULTS.ollama).toBeDefined();
    expect(CUSTOM_LLM_DEFAULTS.vllm).toBeDefined();
    expect(CUSTOM_LLM_DEFAULTS['llama-cpp']).toBeDefined();
    expect(CUSTOM_LLM_DEFAULTS['generic-openai']).toBeDefined();
  });

  it('has labels for all backends', () => {
    expect(CUSTOM_LLM_BACKEND_LABELS.ollama).toBe('Ollama');
    expect(CUSTOM_LLM_BACKEND_LABELS.vllm).toBe('vLLM');
  });
});
