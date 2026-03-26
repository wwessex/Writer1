import { describe, expect, it } from 'vitest';
import {
  mapAIConnectionFailureMessage,
  validateAiEndpointUrl,
  validateAuthorizationHeader,
  validateLocalLlmConfig,
  validateSyncServerUrl,
} from './settingsValidation';

describe('settingsValidation helpers', () => {
  it('validates AI endpoint URLs', () => {
    expect(validateAiEndpointUrl('https://api.openai.com/v1/chat/completions').valid).toBe(true);
    expect(validateAiEndpointUrl('notaurl').valid).toBe(false);
  });

  it('validates sync URL and auth header shape', () => {
    expect(validateSyncServerUrl('https://sync.example.com').valid).toBe(true);
    expect(validateSyncServerUrl('ftp://sync.example.com').valid).toBe(false);

    expect(validateAuthorizationHeader('Bearer abc123').valid).toBe(true);
    expect(validateAuthorizationHeader('abc123').valid).toBe(false);
  });

  it('requires local llm base URL and model', () => {
    expect(validateLocalLlmConfig({ baseUrl: 'http://localhost:11434', model: 'narratryx:latest' }).valid).toBe(true);
    expect(validateLocalLlmConfig({ baseUrl: '', model: '' }).valid).toBe(false);
  });

  it('maps technical failures to remediation copy', () => {
    expect(mapAIConnectionFailureMessage({ status: 401 })).toContain('API key rejected');
    expect(mapAIConnectionFailureMessage({ status: 404, errorText: 'model not found' })).toContain('Model not found');
    expect(mapAIConnectionFailureMessage({ errorMessage: 'Failed to fetch' })).toContain('Cannot reach the AI server');
  });
});
