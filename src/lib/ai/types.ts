/**
 * Shared types for the AI provider abstraction layer.
 *
 * Two providers are supported:
 * - chrome-ai  : Chrome Built-in AI (Gemini Nano, on-device, free, no API key)
 * - openai-compatible : Any OpenAI-compatible chat completion endpoint
 */

/* ------------------------------------------------------------------ */
/*  Provider & config                                                  */
/* ------------------------------------------------------------------ */

export type AIProviderType = 'chrome-ai' | 'openai-compatible';

export interface AIProviderConfig {
  provider: AIProviderType;
  /** OpenAI-compatible endpoint URL (only for openai-compatible) */
  endpoint?: string;
  /** Bearer token / API key (only for openai-compatible) */
  apiKey?: string;
  /** Model identifier (only for openai-compatible, defaults to gpt-4o) */
  model?: string;
}

/* ------------------------------------------------------------------ */
/*  Request / response                                                 */
/* ------------------------------------------------------------------ */

export interface AIRequest {
  /** Preset action id (e.g. 'continue', 'summarize') or 'custom' */
  action: string;
  /** The user-facing prompt text */
  prompt: string;
  /** Context text from the chapter/scene */
  context: string;
  /** Project type – used to tune system prompts */
  projectType: 'book' | 'screenplay';
  /** Optional section title for additional context */
  sectionTitle?: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface AIResponse {
  text: string;
  provider: AIProviderType;
  /** Round-trip latency in milliseconds */
  latencyMs: number;
}

/* ------------------------------------------------------------------ */
/*  Availability                                                       */
/* ------------------------------------------------------------------ */

export type AvailabilityStatus =
  | 'readily'        // Ready to use immediately
  | 'after-download' // Available after model download
  | 'no'            // Not available on this platform / browser
  | 'unknown';      // Cannot determine

export interface ChromeAIAvailability {
  languageModel: AvailabilityStatus;
  summarizer: AvailabilityStatus;
  writer: AvailabilityStatus;
  rewriter: AvailabilityStatus;
}

/* ------------------------------------------------------------------ */
/*  Provider interface                                                 */
/* ------------------------------------------------------------------ */

export interface AIProvider {
  readonly type: AIProviderType;
  /** Check whether this provider is available and ready to use */
  isAvailable(): boolean;
  /** Execute an AI request and return the response text */
  execute(request: AIRequest): Promise<AIResponse>;
  /** Release any held resources (sessions, etc.) */
  destroy(): void;
}
