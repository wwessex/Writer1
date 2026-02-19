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
} from './types';

export { ChromeAIProvider } from './chromeAI';
export { OpenAIProvider } from './openaiProvider';
export { ServerProxyProvider, SERVER_PROXY_ENDPOINTS, SERVER_PROXY_MODELS, SERVER_PROXY_LABELS } from './serverProxyProvider';

export {
  loadAIConfig,
  saveAIConfig,
  createProvider,
  detectBestProvider,
  isChromeWithoutAI,
} from './providerManager';

export {
  checkChromeAIAvailability,
  isChromeAIAvailable,
  isChromeBrowser,
} from './availability';
