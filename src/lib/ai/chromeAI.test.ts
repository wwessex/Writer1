import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChromeAIProvider } from './chromeAI';
import type { AIRequest } from './types';

vi.mock('./availability', () => ({
  isChromeBrowser: vi.fn(() => true),
}));

import { isChromeBrowser } from './availability';
const mockIsChromeBrowser = vi.mocked(isChromeBrowser);

/* ------------------------------------------------------------------ */
/*  Globals stubs for Chrome AI APIs                                    */
/* ------------------------------------------------------------------ */

const mockSession = {
  prompt: vi.fn().mockResolvedValue('prompt response'),
  destroy: vi.fn(),
};

const mockSummarizer = {
  summarize: vi.fn().mockResolvedValue('summary response'),
  destroy: vi.fn(),
};

const mockWriter = {
  write: vi.fn().mockResolvedValue('writer response'),
  destroy: vi.fn(),
};

const mockRewriter = {
  rewrite: vi.fn().mockResolvedValue('rewriter response'),
  destroy: vi.fn(),
};

function installGlobals() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  g.LanguageModel = { create: vi.fn().mockResolvedValue(mockSession) };
  g.Summarizer = { create: vi.fn().mockResolvedValue(mockSummarizer) };
  g.Writer = { create: vi.fn().mockResolvedValue(mockWriter) };
  g.Rewriter = { create: vi.fn().mockResolvedValue(mockRewriter) };
}

function removeGlobals() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  delete g.LanguageModel;
  delete g.Summarizer;
  delete g.Writer;
  delete g.Rewriter;
}

function makeRequest(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    action: 'custom',
    prompt: 'Write a paragraph.',
    context: 'Once upon a time...',
    projectType: 'book',
    ...overrides,
  };
}

describe('ChromeAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsChromeBrowser.mockReturnValue(true);
    installGlobals();
  });

  afterEach(() => {
    removeGlobals();
  });

  describe('isAvailable', () => {
    it('returns true when LanguageModel global exists in Chrome', () => {
      const provider = new ChromeAIProvider();
      expect(provider.isAvailable()).toBe(true);
    });

    it('returns false when not Chrome', () => {
      mockIsChromeBrowser.mockReturnValue(false);
      const provider = new ChromeAIProvider();
      expect(provider.isAvailable()).toBe(false);
    });

    it('returns true when ai.languageModel exists', () => {
      removeGlobals();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).ai = { languageModel: {} };
      const provider = new ChromeAIProvider();
      expect(provider.isAvailable()).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).ai;
    });

    it('returns false when no AI globals exist', () => {
      removeGlobals();
      const provider = new ChromeAIProvider();
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('execute', () => {
    it('routes "grammar" action to prompt API', async () => {
      const provider = new ChromeAIProvider();
      const result = await provider.execute(makeRequest({ action: 'grammar' }));

      expect(result.text).toBe('prompt response');
      expect(result.provider).toBe('chrome-ai');
      expect(mockSession.destroy).toHaveBeenCalled();
    });

    it('routes "summarize" action to Summarizer', async () => {
      const provider = new ChromeAIProvider();
      const result = await provider.execute(makeRequest({ action: 'summarize' }));

      expect(result.text).toBe('summary response');
      expect(mockSummarizer.destroy).toHaveBeenCalled();
    });

    it('routes "continue" action to Writer', async () => {
      const provider = new ChromeAIProvider();
      const result = await provider.execute(makeRequest({ action: 'continue' }));

      expect(result.text).toBe('writer response');
      expect(mockWriter.destroy).toHaveBeenCalled();
    });

    it('routes "alternatives" action to Rewriter', async () => {
      const provider = new ChromeAIProvider();
      const result = await provider.execute(makeRequest({ action: 'alternatives' }));

      expect(result.text).toBe('rewriter response');
      expect(mockRewriter.destroy).toHaveBeenCalled();
    });

    it('routes unknown action to prompt API', async () => {
      const provider = new ChromeAIProvider();
      const result = await provider.execute(makeRequest({ action: 'unknownAction' }));

      expect(result.text).toBe('prompt response');
    });

    it('truncates context to MAX_CONTEXT_CHARS', async () => {
      const provider = new ChromeAIProvider();
      const longContext = 'x'.repeat(10000);
      await provider.execute(makeRequest({ action: 'grammar', context: longContext }));

      const promptArg = mockSession.prompt.mock.calls[0][0] as string;
      // Context portion should be truncated to 4000 chars
      expect(promptArg.length).toBeLessThan(10000);
    });

    it('falls back to Prompt API on TypeError from specialized API', async () => {
      mockWriter.write.mockRejectedValueOnce(new TypeError('API not supported'));
      const provider = new ChromeAIProvider();
      const result = await provider.execute(makeRequest({ action: 'continue' }));

      expect(result.text).toBe('prompt response');
    });

    it('falls back to Prompt API on NotSupportedError', async () => {
      const err = new DOMException('Not supported', 'NotSupportedError');
      mockSummarizer.summarize.mockRejectedValueOnce(err);
      const provider = new ChromeAIProvider();
      const result = await provider.execute(makeRequest({ action: 'summarize' }));

      expect(result.text).toBe('prompt response');
    });

    it('rethrows AbortError without fallback', async () => {
      const err = new DOMException('Aborted', 'AbortError');
      mockWriter.write.mockRejectedValueOnce(err);
      const provider = new ChromeAIProvider();

      await expect(provider.execute(makeRequest({ action: 'continue' }))).rejects.toThrow('Aborted');
    });

    it('rethrows non-unavailability errors without fallback', async () => {
      mockWriter.write.mockRejectedValueOnce(new Error('Quota exceeded'));
      const provider = new ChromeAIProvider();

      await expect(provider.execute(makeRequest({ action: 'continue' }))).rejects.toThrow('Quota exceeded');
    });

    it('uses "shorten" action with rewriter length shorter', async () => {
      const provider = new ChromeAIProvider();
      await provider.execute(makeRequest({ action: 'shorten' }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createCall = (globalThis as any).Rewriter.create.mock.calls[0][0];
      expect(createCall.length).toBe('shorter');
    });

    it('uses prompt without context prefix when context is empty', async () => {
      const provider = new ChromeAIProvider();
      await provider.execute(makeRequest({ action: 'grammar', context: '' }));

      const promptArg = mockSession.prompt.mock.calls[0][0] as string;
      expect(promptArg).toBe('Write a paragraph.');
    });
  });

  describe('metadata', () => {
    it('has correct type', () => {
      const provider = new ChromeAIProvider();
      expect(provider.type).toBe('chrome-ai');
    });

    it('destroy is a no-op', () => {
      const provider = new ChromeAIProvider();
      expect(() => provider.destroy()).not.toThrow();
    });
  });
});
