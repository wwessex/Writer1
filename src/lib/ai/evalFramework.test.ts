import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runEvalSuite,
  saveEvalResult,
  loadEvalHistory,
  EVAL_PROMPTS,
  DEFAULT_EVAL_DIMENSIONS,
} from './evalFramework';
import type { AIProvider, AIResponse } from './types';

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

function makeMockProvider(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    type: 'custom-llm',
    isAvailable: () => true,
    execute: vi.fn().mockResolvedValue({
      text: 'Sarah looked at the letter again. The rain had stopped, but the words still haunted her. She whispered to herself, "This changes everything." The dark room felt colder now.',
      provider: 'custom-llm',
      latencyMs: 500,
    } as AIResponse),
    destroy: vi.fn(),
    ...overrides,
  };
}

describe('evalFramework', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('EVAL_PROMPTS', () => {
    it('has at least 5 benchmark prompts', () => {
      expect(EVAL_PROMPTS.length).toBeGreaterThanOrEqual(5);
    });

    it('each prompt has required fields', () => {
      for (const prompt of EVAL_PROMPTS) {
        expect(prompt.id).toBeTruthy();
        expect(prompt.label).toBeTruthy();
        expect(prompt.prompt).toBeTruthy();
        expect(prompt.context).toBeTruthy();
        expect(prompt.expectedTraits).toBeInstanceOf(Array);
        expect(prompt.maxLatencyMs).toBeGreaterThan(0);
      }
    });
  });

  describe('DEFAULT_EVAL_DIMENSIONS', () => {
    it('has 5 dimensions', () => {
      expect(DEFAULT_EVAL_DIMENSIONS).toHaveLength(5);
    });

    it('weights sum to approximately 1', () => {
      const sum = DEFAULT_EVAL_DIMENSIONS.reduce((s, d) => s + d.weight, 0);
      expect(sum).toBeCloseTo(1, 2);
    });
  });

  describe('runEvalSuite', () => {
    it('runs all prompts and returns results', async () => {
      const provider = makeMockProvider();
      const result = await runEvalSuite(provider, 'test-model');

      expect(result.provider).toBe('custom-llm');
      expect(result.model).toBe('test-model');
      expect(result.results.length).toBe(EVAL_PROMPTS.length);
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.passRate).toBeGreaterThanOrEqual(0);
      expect(result.averageLatencyMs).toBeGreaterThan(0);
      expect(['ready', 'needs-work', 'not-ready']).toContain(result.recommendation);
    });

    it('handles provider errors gracefully', async () => {
      const provider = makeMockProvider({
        execute: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });

      const result = await runEvalSuite(provider, 'failing-model');

      expect(result.results.length).toBe(EVAL_PROMPTS.length);
      for (const r of result.results) {
        expect(r.errors.length).toBeGreaterThan(0);
        expect(r.passed).toBe(false);
      }
      expect(result.recommendation).toBe('not-ready');
    });

    it('scores good responses higher than empty responses', async () => {
      const goodProvider = makeMockProvider({
        execute: vi.fn().mockResolvedValue({
          text: 'Sarah read the letter carefully. The rain drummed against the windowpane as memories flooded back. "Three years," she whispered, her voice trembling. Marcus had written about the garden, the old house, and the promise they made.',
          provider: 'custom-llm',
          latencyMs: 200,
        }),
      });

      const emptyProvider = makeMockProvider({
        execute: vi.fn().mockResolvedValue({
          text: '',
          provider: 'custom-llm',
          latencyMs: 50,
        }),
      });

      const goodResult = await runEvalSuite(goodProvider, 'good-model');
      const emptyResult = await runEvalSuite(emptyProvider, 'empty-model');

      expect(goodResult.overallScore).toBeGreaterThan(emptyResult.overallScore);
    });

    it('respects abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const provider = makeMockProvider();
      const result = await runEvalSuite(provider, 'test', undefined, undefined, controller.signal);

      expect(result.results.length).toBe(0);
    });

    it('supports custom prompt subset', async () => {
      const provider = makeMockProvider();
      const customPrompts = [EVAL_PROMPTS[0]];
      const result = await runEvalSuite(provider, 'test', customPrompts);

      expect(result.results.length).toBe(1);
    });
  });

  describe('saveEvalResult / loadEvalHistory', () => {
    it('persists and loads results', () => {
      const result = {
        provider: 'custom-llm',
        model: 'test',
        timestamp: Date.now(),
        results: [],
        overallScore: 0.75,
        passRate: 0.8,
        averageLatencyMs: 500,
        recommendation: 'ready' as const,
      };

      saveEvalResult(result);
      const history = loadEvalHistory();

      expect(history.length).toBe(1);
      expect(history[0].model).toBe('test');
      expect(history[0].overallScore).toBe(0.75);
    });

    it('returns empty array when no history', () => {
      expect(loadEvalHistory()).toEqual([]);
    });

    it('limits stored results to 20', () => {
      for (let i = 0; i < 25; i++) {
        saveEvalResult({
          provider: 'custom-llm',
          model: `model-${i}`,
          timestamp: Date.now(),
          results: [],
          overallScore: 0.5,
          passRate: 0.5,
          averageLatencyMs: 100,
          recommendation: 'needs-work',
        });
      }

      const history = loadEvalHistory();
      expect(history.length).toBe(20);
    });
  });
});
