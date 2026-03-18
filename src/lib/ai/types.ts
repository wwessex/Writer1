/**
 * Shared types for the AI provider abstraction layer.
 *
 * Supported providers:
 * - chrome-ai  : Chrome Built-in AI (Gemini Nano, on-device, free, no API key)
 * - managed-cloud : DraftHarbour managed cloud AI endpoint (default cloud fallback)
 * - openai-compatible : Any OpenAI-compatible chat completion endpoint
 * - server-proxy : Routes through PHP proxy to Groq / OpenRouter / Gemini
 * - custom-llm : Local or self-hosted LLM (Ollama, vLLM, llama.cpp server)
 */

/* ------------------------------------------------------------------ */
/*  Provider & config                                                  */
/* ------------------------------------------------------------------ */

export type AIProviderType = 'chrome-ai' | 'managed-cloud' | 'openai-compatible' | 'server-proxy' | 'custom-llm';

/** LLM provider routed through the server-side proxy */
export type ServerProxyProviderType = 'groq' | 'openrouter' | 'gemini';

/** Backend type for custom LLM inference */
export type CustomLlmBackend = 'ollama' | 'vllm' | 'llama-cpp' | 'generic-openai';

export interface ServerProxyConfig {
  /** Which LLM provider to route through the server */
  serverProvider: ServerProxyProviderType;
  /** Model identifier for the selected provider */
  model: string;
  /** User's own API key for BYOK (optional, sent to server per-request) */
  userApiKey?: string;
}

export interface CustomLlmConfig {
  /** Inference backend type */
  backend: CustomLlmBackend;
  /** Base URL for the inference endpoint (e.g. http://localhost:11434 for Ollama) */
  baseUrl: string;
  /** Model name/tag to use (e.g. 'narratryx:latest', 'qwen2.5:7b') */
  model: string;
  /** Optional API key for authenticated endpoints */
  apiKey?: string;
  /** Enable streaming responses (SSE) */
  streaming?: boolean;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature (0.0 - 2.0) */
  temperature?: number;
  /** Provider to fall back to if this provider fails */
  fallbackProvider?: AIProviderType;
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
  /** Custom LLM sub-config (only when provider === 'custom-llm') */
  customLlm?: CustomLlmConfig;
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
  /** Callback for streaming token chunks (if provider supports it) */
  onStreamChunk?: (chunk: string, accumulated: string) => void;
  /** Story Bible context for long-document awareness */
  storyBibleContext?: StoryBibleContext;
}

export interface AIResponse {
  text: string;
  provider: AIProviderType;
  /** Round-trip latency in milliseconds */
  latencyMs: number;
  /** Whether the response was streamed */
  streamed?: boolean;
  /** Token usage info (available from server-proxy providers) */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Story Bible context (for long-document awareness)                  */
/* ------------------------------------------------------------------ */

export interface StoryBibleEntity {
  name: string;
  type: 'character' | 'location' | 'item' | 'concept';
  description: string;
  triggerKeywords: string[];
}

export interface StoryBibleContext {
  entities: StoryBibleEntity[];
  recentSceneSummaries: string[];
  styleNotes: string;
  /** Token budget for context injection (default 2048) */
  tokenBudget?: number;
}

/* ------------------------------------------------------------------ */
/*  Fallback chain                                                     */
/* ------------------------------------------------------------------ */

export interface FallbackConfig {
  /** Ordered list of providers to try */
  chain: AIProviderConfig[];
  /** Max retries per provider before falling back */
  maxRetriesPerProvider: number;
  /** Base delay in ms for exponential backoff */
  retryBaseDelayMs: number;
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
  /** Whether this provider supports streaming responses */
  supportsStreaming?: boolean;
  /** Release any held resources (sessions, etc.) */
  destroy(): void;
}
