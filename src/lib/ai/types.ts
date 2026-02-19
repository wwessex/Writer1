/**
 * Shared types for the AI provider abstraction layer.
 *
 * Three providers are supported:
 * - chrome-ai  : Chrome Built-in AI (Gemini Nano, on-device, free, no API key)
 * - managed-cloud : DraftHarbour managed cloud AI endpoint (default cloud fallback)
 * - openai-compatible : Any OpenAI-compatible chat completion endpoint
 */

/* ------------------------------------------------------------------ */
/*  Provider & config                                                  */
/* ------------------------------------------------------------------ */

export type AIProviderType = 'chrome-ai' | 'managed-cloud' | 'openai-compatible' | 'server-proxy';

/** LLM provider routed through the server-side proxy */
export type ServerProxyProviderType = 'groq' | 'openrouter' | 'gemini';

export interface ServerProxyConfig {
  /** Which LLM provider to route through the server */
  serverProvider: ServerProxyProviderType;
  /** Model identifier for the selected provider */
  model: string;
  /** User's own API key for BYOK (optional, sent to server per-request) */
  userApiKey?: string;
}

export interface AIProviderConfig {
  provider: AIProviderType;
  /** OpenAI-compatible endpoint URL (only for openai-compatible) */
  endpoint?: string;
  /** API key or session token for OpenAI-compatible endpoints (persisted to localStorage) */
  sessionToken?: string;
  /** Model identifier (only for openai-compatible, defaults to gpt-4o) */
  model?: string;
  /** Server proxy sub-config (only when provider === 'server-proxy') */
  serverProxy?: ServerProxyConfig;
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
  /** Token usage info (available from server-proxy providers) */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Availability                                                       */
/* ------------------------------------------------------------------ */

/**
 * Normalised availability status.
 *
 * Chrome ≤ 137 returned  'readily' | 'after-download' | 'no'.
 * Chrome 138+ returns    'available' | 'downloadable' | 'downloading' | 'unavailable'.
 *
 * We normalise both sets into the new vocabulary so the rest of the app
 * only needs to check the current values.
 */
export type AvailabilityStatus =
  | 'available'      // Ready to use immediately  (was 'readily')
  | 'downloadable'   // Available after model download (was 'after-download')
  | 'downloading'    // Model download in progress (new in Chrome 138)
  | 'unavailable'    // Not available on this platform / browser (was 'no')
  | 'unknown';       // Cannot determine

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
