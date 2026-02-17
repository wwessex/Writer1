/**
 * TypeScript declarations for Chrome Built-in AI APIs.
 *
 * These APIs are available in Chrome 138+ (stable) on supported platforms
 * (macOS 13+, Windows 10+, Linux). They run Gemini Nano on-device.
 *
 * Chrome ≤ 137 returned 'readily' | 'after-download' | 'no' from availability().
 * Chrome 138+ returns  'available' | 'downloadable' | 'downloading' | 'unavailable'.
 *
 * We declare the union of both sets so the code compiles against any version.
 *
 * @see https://developer.chrome.com/docs/ai/built-in-apis
 */

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

/** Return type of availability() — union of old (≤ 137) and new (138+) values. */
type ChromeAIAvailabilityResult =
  | 'readily'        // Legacy (≤ 137): ready immediately
  | 'after-download' // Legacy (≤ 137): needs download
  | 'no'             // Legacy (≤ 137): not available
  | 'available'      // 138+: ready immediately
  | 'downloadable'   // 138+: needs download
  | 'downloading'    // 138+: download in progress
  | 'unavailable';   // 138+: not available

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
  /** Chrome 140+: declare expected input modalities / languages. */
  expectedInputs?: Array<{ type: string; languages?: string[] }>;
  /** Chrome 140+: declare expected output modalities / languages. */
  expectedOutputs?: Array<{ type: string; languages?: string[] }>;
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
  availability(options?: Record<string, unknown>): Promise<ChromeAIAvailabilityResult>;
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
  availability(options?: Record<string, unknown>): Promise<ChromeAIAvailabilityResult>;
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
  availability(options?: Record<string, unknown>): Promise<ChromeAIAvailabilityResult>;
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
  availability(options?: Record<string, unknown>): Promise<ChromeAIAvailabilityResult>;
  create(options?: RewriterCreateOptions): Promise<RewriterSession>;
}

declare const Rewriter: RewriterAPI;
