export type AIConfigMode = 'automatic' | 'server-provider' | 'custom-endpoint' | 'local-llm';

export const AI_MODE_LABELS: Record<AIConfigMode, string> = {
  automatic: 'Automatic',
  'server-provider': 'Hosted Provider',
  'custom-endpoint': 'Custom Endpoint',
  'local-llm': 'Local Model',
};

export const AI_MODE_HELP_TEXT: Record<AIConfigMode, string> = {
  automatic: 'Let Writer pick the best route: on-device when available, otherwise hosted.',
  'server-provider': 'Use a built-in hosted provider and choose a model for your account.',
  'custom-endpoint': 'Send requests directly to your own OpenAI-compatible API endpoint.',
  'local-llm': 'Connect to a model server you run locally or on your own infrastructure.',
};

export const AI_MODE_DATA_DESTINATION_TEXT: Record<AIConfigMode, string> = {
  automatic: 'Where your data goes: Writer first tries on-device processing, then uses a hosted provider when needed.',
  'server-provider': 'Where your data goes: Writer sends requests to the hosted provider you selected.',
  'custom-endpoint': 'Where your data goes: Writer sends requests directly to your configured endpoint.',
  'local-llm': 'Where your data goes: Writer sends requests to your local model endpoint.',
};
