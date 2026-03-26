import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { CUSTOM_LLM_BACKEND_LABELS, CUSTOM_LLM_DEFAULTS, fetchOllamaModels } from '@/lib/ai';
import type { AIProviderConfig, CustomLlmBackend, CustomLlmConfig } from '@/lib/ai';
import { AI_CONFIG_TEXT, AI_ENDPOINT_PRESETS, matchAIPresetId } from '@/lib/ai/configUi';

interface TestResult {
  ok: boolean;
  message: string;
}

interface AIConfigPanelProps {
  mode: 'compact' | 'full' | 'embedded';
  config: AIProviderConfig;
  onConfigChange: (updates: Partial<AIProviderConfig>) => void;
  onCustomLlmConfigChange: (updates: Partial<CustomLlmConfig>) => void;
  onTestEndpoint?: () => void | Promise<void>;
  onTestLocalLlm?: () => void | Promise<void>;
  endpointTestResult?: TestResult | null;
  localLlmTestResult?: TestResult | null;
  endpointTesting?: boolean;
  localLlmTesting?: boolean;
  showProviderFields?: boolean;
  showLocalFields?: boolean;
}

export function AIConfigPanel({
  mode,
  config,
  onConfigChange,
  onCustomLlmConfigChange,
  onTestEndpoint,
  onTestLocalLlm,
  endpointTestResult,
  localLlmTestResult,
  endpointTesting = false,
  localLlmTesting = false,
  showProviderFields = true,
  showLocalFields = true,
}: AIConfigPanelProps) {
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModelsFetching, setOllamaModelsFetching] = useState(false);

  const customLlmBackend = config.customLlm?.backend;
  const customLlmBaseUrl = config.customLlm?.baseUrl;
  useEffect(() => {
    if (!showLocalFields) return;
    if (customLlmBackend === 'ollama' && customLlmBaseUrl?.trim()) {
      setOllamaModelsFetching(true);
      fetchOllamaModels(customLlmBaseUrl)
        .then(models => setOllamaModels(models))
        .catch(() => setOllamaModels([]))
        .finally(() => setOllamaModelsFetching(false));
      return;
    }
    setOllamaModels([]);
  }, [customLlmBackend, customLlmBaseUrl, showLocalFields]);

  const matchedPresetId = useMemo(() => matchAIPresetId(config.endpoint), [config.endpoint]);
  const isCompact = mode === 'compact';

  return (
    <div>
      {showProviderFields && (
        <>
          <div>
            <p>{AI_CONFIG_TEXT.setupCta} {AI_CONFIG_TEXT.keyStorage}</p>
          </div>
          <div>
            <label>Provider</label>
            <div>
              {AI_ENDPOINT_PRESETS.map(preset => {
                const isActive = matchedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    aria-pressed={isActive}
                    onClick={() => onConfigChange({
                      provider: 'openai-compatible',
                      endpoint: preset.endpoint,
                      model: config.model?.trim() ? config.model : preset.defaultModel,
                    })}
                  >
                    <strong>{preset.label}</strong>
                    <small>{preset.signupUrl}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label>
              API Endpoint
              <HelpTooltip text="OpenAI-compatible chat completions endpoint" />
            </label>
            <Input
              placeholder="https://api.openai.com/v1/chat/completions"
              value={config.endpoint || ''}
              onChange={e => onConfigChange({ endpoint: e.target.value })}
            />
          </div>
          <div>
            <label>
              API Key
              <HelpTooltip text="Your API key from OpenAI or any compatible provider" />
            </label>
            <Input
              type="password"
              placeholder={AI_ENDPOINT_PRESETS.find(p => p.id === matchedPresetId)?.keyPlaceholder ?? 'sk-...'}
              value={config.sessionToken || ''}
              onChange={e => onConfigChange({ sessionToken: e.target.value })}
            />
          </div>
          <div>
            <label>
              Model
              <HelpTooltip text="Model identifier sent with requests" />
            </label>
            <Input
              placeholder={AI_ENDPOINT_PRESETS.find(p => p.id === matchedPresetId)?.defaultModel ?? 'gpt-4o'}
              value={config.model || ''}
              onChange={e => onConfigChange({ model: e.target.value })}
            />
          </div>
          {!isCompact && onTestEndpoint && (
            <div>
              <Button
                onClick={onTestEndpoint}
                size="small"
                disabled={endpointTesting || !config.endpoint?.trim() || !config.sessionToken?.trim()}
              >
                {endpointTesting ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          )}
          {endpointTestResult && <p>{endpointTestResult.message}</p>}
          {config.endpoint?.trim() && config.sessionToken?.trim() && config.provider !== 'openai-compatible' && (
            <p>
              Endpoint and API key are set, but mode is not Custom Endpoint.
              <button onClick={() => onConfigChange({ provider: 'openai-compatible' })}>
                Switch to Custom Endpoint mode
              </button>
            </p>
          )}
          {config.endpoint?.trim() && config.sessionToken?.trim() && <p>{AI_CONFIG_TEXT.configuredCta}</p>}
        </>
      )}

      {showLocalFields && (
        <>
          <div>
            <p>{AI_CONFIG_TEXT.localSetup}</p>
          </div>
          <div>
            <label>Backend</label>
            <div>
              {(Object.keys(CUSTOM_LLM_DEFAULTS) as CustomLlmBackend[]).map(backend => {
                const isActive = config.provider === 'custom-llm' && config.customLlm?.backend === backend;
                return (
                  <button
                    key={backend}
                    aria-pressed={isActive}
                    onClick={() => onCustomLlmConfigChange({
                      backend,
                      baseUrl: CUSTOM_LLM_DEFAULTS[backend].baseUrl,
                      model: CUSTOM_LLM_DEFAULTS[backend].model,
                    })}
                  >
                    <strong>{CUSTOM_LLM_BACKEND_LABELS[backend]}</strong>
                    <small>{CUSTOM_LLM_DEFAULTS[backend].baseUrl}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label>
              Base URL
              <HelpTooltip text="The base URL of your inference server" />
            </label>
            <Input
              placeholder={CUSTOM_LLM_DEFAULTS[config.customLlm?.backend ?? 'ollama'].baseUrl}
              value={config.customLlm?.baseUrl ?? ''}
              onChange={e => onCustomLlmConfigChange({ baseUrl: e.target.value })}
            />
          </div>
          <div>
            <label>
              Model
              <HelpTooltip text="Model name or tag" />
            </label>
            {ollamaModelsFetching ? (
              <Input placeholder="Fetching models..." disabled />
            ) : ollamaModels.length > 0 ? (
              <Select
                options={[
                  ...ollamaModels.map(model => ({ value: model, label: model })),
                  { value: '__custom__', label: 'Custom...' },
                ]}
                value={ollamaModels.includes(config.customLlm?.model ?? '') ? (config.customLlm?.model ?? '') : '__custom__'}
                onChange={e => {
                  if (e.target.value !== '__custom__') {
                    onCustomLlmConfigChange({ model: e.target.value });
                  }
                }}
              />
            ) : (
              <Input
                placeholder={CUSTOM_LLM_DEFAULTS[config.customLlm?.backend ?? 'ollama'].model}
                value={config.customLlm?.model ?? ''}
                onChange={e => onCustomLlmConfigChange({ model: e.target.value })}
              />
            )}
          </div>
          <div>
            <label>
              API Key
              <HelpTooltip text="Optional API key for authenticated endpoints" />
            </label>
            <Input
              type="password"
              placeholder="Optional"
              value={config.customLlm?.apiKey ?? ''}
              onChange={e => onCustomLlmConfigChange({ apiKey: e.target.value })}
            />
          </div>
          {onTestLocalLlm && (
            <div>
              <Button
                onClick={onTestLocalLlm}
                size="small"
                disabled={localLlmTesting || !config.customLlm?.baseUrl?.trim() || !config.customLlm?.model?.trim()}
              >
                {localLlmTesting ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>
          )}
          {localLlmTestResult && <p>{localLlmTestResult.message}</p>}
        </>
      )}
    </div>
  );
}
