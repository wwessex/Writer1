import type { AIProviderConfig } from './types';

export interface AIEndpointPreset {
  id: string;
  label: string;
  endpoint: string;
  defaultModel: string;
  keyPlaceholder: string;
  signupUrl: string;
}

export const AI_ENDPOINT_PRESETS: AIEndpointPreset[] = [
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o', keyPlaceholder: 'sk-...', signupUrl: 'platform.openai.com' },
  { id: 'groq', label: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile', keyPlaceholder: 'gsk_...', signupUrl: 'console.groq.com' },
  { id: 'openrouter', label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'google/gemini-2.0-flash-exp:free', keyPlaceholder: 'sk-or-...', signupUrl: 'openrouter.ai' },
  { id: 'mistral', label: 'Mistral', endpoint: 'https://api.mistral.ai/v1/chat/completions', defaultModel: 'mistral-large-latest', keyPlaceholder: 'api key', signupUrl: 'console.mistral.ai' },
  { id: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions', defaultModel: 'deepseek-chat', keyPlaceholder: 'sk-...', signupUrl: 'platform.deepseek.com' },
  { id: 'together', label: 'Together AI', endpoint: 'https://api.together.xyz/v1/chat/completions', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyPlaceholder: 'api key', signupUrl: 'api.together.ai' },
];

export const AI_CONFIG_TEXT = {
  setupCta: 'Pick a provider below, then paste your API key to enable AI writing tools.',
  keyStorage: 'Your API key is stored locally in your browser and only sent to the endpoint you specify.',
  localSetup: 'Connect to a local or self-hosted LLM server (Ollama, vLLM, llama.cpp). All data stays on your machine.',
  configuredCta: 'AI provider configured. Open AI Writing Tools from the menu to start using AI assistance.',
  endpointValidation: 'Enter an API endpoint and key to test this provider.',
  localValidation: 'Enter a base URL and model to test this local setup.',
} as const;

export type AIConfigMode = 'automatic' | 'server-provider' | 'custom-endpoint' | 'local-llm';

export function resolveAIConfigMode(config: AIProviderConfig): AIConfigMode {
  if (config.provider === 'server-proxy') return 'server-provider';
  if (config.provider === 'openai-compatible') return 'custom-endpoint';
  if (config.provider === 'custom-llm') return 'local-llm';
  return 'automatic';
}

export const AI_MODE_LABELS: Record<AIConfigMode, string> = {
  automatic: 'Automatic',
  'server-provider': 'Server Provider',
  'custom-endpoint': 'Custom Endpoint',
  'local-llm': 'Local LLM',
};

export const AI_MODE_HELP_TEXT: Record<AIConfigMode, string> = {
  automatic: 'Requests use the app-selected default route (local/browser model when available, otherwise managed cloud).',
  'server-provider': 'Requests go to the server provider you select (direct with your API key, or via proxy when no key is provided).',
  'custom-endpoint': 'Requests go directly to your OpenAI-compatible endpoint using the API key entered here.',
  'local-llm': 'Requests stay on your local/self-hosted LLM endpoint and use your local endpoint credentials if configured.',
};

export function matchAIPresetId(endpoint?: string): string {
  if (!endpoint?.trim()) return '';
  const normalized = endpoint.trim().replace(/\/$/, '');
  return AI_ENDPOINT_PRESETS.find(preset => preset.endpoint === normalized)?.id ?? '';
}
