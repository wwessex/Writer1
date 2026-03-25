// AI provider abstraction – public API

export type {
  AIProviderType,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIProvider,
  AvailabilityStatus,
  ChromeAIAvailability,
  ServerProxyProviderType,
  ServerProxyConfig,
  CustomLlmBackend,
  CustomLlmConfig,
  StoryBibleContext,
  StoryBibleEntity,
  FallbackConfig,
} from './types';

export { ChromeAIProvider } from './chromeAI';
export { OpenAIProvider } from './openaiProvider';
export { ServerProxyProvider, SERVER_PROXY_ENDPOINTS, SERVER_PROXY_MODELS, SERVER_PROXY_LABELS } from './serverProxyProvider';
export { CustomLlmProvider, CUSTOM_LLM_DEFAULTS, CUSTOM_LLM_BACKEND_LABELS, fetchOllamaModels, testCustomLlmConnection } from './customLlmProvider';
export { FallbackProvider, buildFallbackChain } from './fallbackProvider';

export {
  loadAIConfig,
  saveAIConfig,
  hydrateDesktopSecrets,
  createProvider,
  detectBestProvider,
  detectLocalLlmConfig,
  isChromeWithoutAI,
} from './providerManager';

export {
  checkChromeAIAvailability,
  isChromeAIAvailable,
  isChromeBrowser,
  detectLocalLlmServer,
} from './availability';

export type { LocalLlmDetection } from './availability';

export {
  assembleStoryBibleContext,
  formatStoryBibleForPrompt,
  loadStoryBible,
  saveStoryBible,
} from './storyBible';

export {
  runEvalSuite,
  saveEvalResult,
  loadEvalHistory,
  EVAL_PROMPTS,
  DEFAULT_EVAL_DIMENSIONS,
} from './evalFramework';

export type {
  EvalSuiteResult,
  EvalResult,
  EvalDimension,
  EvalPrompt,
} from './evalFramework';

export type {
  StoredStoryBible,
} from './storyBible';
