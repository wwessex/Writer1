// AI provider abstraction – public API

export type {
  AIProviderType,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIProvider,
  AvailabilityStatus,
  ChromeAIAvailability,
} from './types';

export { ChromeAIProvider } from './chromeAI';
export { OpenAIProvider } from './openaiProvider';

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
