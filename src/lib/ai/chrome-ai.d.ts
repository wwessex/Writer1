/**
 * TypeScript declarations for Chrome Built-in AI APIs.
 *
 * These APIs are available in Chrome 137+ on supported platforms
 * (macOS 13+, Windows 10+, Linux). They run Gemini Nano on-device.
 *
 * @see https://developer.chrome.com/docs/ai/built-in-apis
 */

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

interface AICreateMonitor {
  addEventListener(
    type: 'downloadprogress',
    handler: (e: ProgressEvent) => void,
  ): void;
}

/* ------------------------------------------------------------------ */
/*  Language Model (Prompt API)                                        */
/* ------------------------------------------------------------------ */

interface LanguageModelCreateOptions {
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface LanguageModelSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(
    input: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<string>;
  destroy(): void;
}

interface LanguageModelAPI {
  availability(): Promise<'readily' | 'after-download' | 'no'>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare const LanguageModel: LanguageModelAPI;

/* ------------------------------------------------------------------ */
/*  Summarizer                                                         */
/* ------------------------------------------------------------------ */

interface SummarizerCreateOptions {
  type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  format?: 'markdown' | 'plain-text';
  length?: 'short' | 'medium' | 'long';
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface SummarizerSession {
  summarize(
    input: string,
    options?: { signal?: AbortSignal; context?: string },
  ): Promise<string>;
  destroy(): void;
}

interface SummarizerAPI {
  availability(): Promise<'readily' | 'after-download' | 'no'>;
  create(options?: SummarizerCreateOptions): Promise<SummarizerSession>;
}

declare const Summarizer: SummarizerAPI;

/* ------------------------------------------------------------------ */
/*  Writer                                                             */
/* ------------------------------------------------------------------ */

interface WriterCreateOptions {
  tone?: 'formal' | 'neutral' | 'casual';
  format?: 'markdown' | 'plain-text';
  length?: 'short' | 'medium' | 'long';
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface WriterSession {
  write(
    input: string,
    options?: { signal?: AbortSignal; context?: string },
  ): Promise<string>;
  destroy(): void;
}

interface WriterAPI {
  availability(): Promise<'readily' | 'after-download' | 'no'>;
  create(options?: WriterCreateOptions): Promise<WriterSession>;
}

declare const Writer: WriterAPI;

/* ------------------------------------------------------------------ */
/*  Rewriter                                                           */
/* ------------------------------------------------------------------ */

interface RewriterCreateOptions {
  tone?: 'more-formal' | 'more-casual' | 'as-is';
  format?: 'markdown' | 'plain-text';
  length?: 'shorter' | 'longer' | 'as-is';
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

interface RewriterSession {
  rewrite(
    input: string,
    options?: { signal?: AbortSignal; context?: string },
  ): Promise<string>;
  destroy(): void;
}

interface RewriterAPI {
  availability(): Promise<'readily' | 'after-download' | 'no'>;
  create(options?: RewriterCreateOptions): Promise<RewriterSession>;
}

declare const Rewriter: RewriterAPI;
