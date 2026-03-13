import { useState, useCallback } from 'react';
import { Input } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { loadAIConfig, saveAIConfig } from '@/lib/ai';
import type { AIProviderConfig } from '@/lib/ai';
import styles from '../Windows.module.css';

interface AIEndpointPreset {
  id: string;
  label: string;
  endpoint: string;
  defaultModel: string;
  keyPlaceholder: string;
  signupUrl: string;
}

const AI_ENDPOINT_PRESETS: AIEndpointPreset[] = [
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o', keyPlaceholder: 'sk-...', signupUrl: 'platform.openai.com' },
  { id: 'groq', label: 'Groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile', keyPlaceholder: 'gsk_...', signupUrl: 'console.groq.com' },
  { id: 'openrouter', label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'google/gemini-2.0-flash-exp:free', keyPlaceholder: 'sk-or-...', signupUrl: 'openrouter.ai' },
  { id: 'mistral', label: 'Mistral', endpoint: 'https://api.mistral.ai/v1/chat/completions', defaultModel: 'mistral-large-latest', keyPlaceholder: 'api key', signupUrl: 'console.mistral.ai' },
  { id: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions', defaultModel: 'deepseek-chat', keyPlaceholder: 'sk-...', signupUrl: 'platform.deepseek.com' },
  { id: 'together', label: 'Together AI', endpoint: 'https://api.together.xyz/v1/chat/completions', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyPlaceholder: 'api key', signupUrl: 'api.together.ai' },
];

function matchAIPresetId(endpoint?: string): string {
  if (!endpoint?.trim()) return '';
  const normalized = endpoint.trim().replace(/\/$/, '');
  return AI_ENDPOINT_PRESETS.find(p => p.endpoint === normalized)?.id ?? '';
}

interface AIProviderSectionProps {
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  highlightMatch: (text: string) => React.ReactNode;
}

export function AIProviderSection({ isFieldVisible, highlightMatch }: AIProviderSectionProps) {
  const [aiConfig, setAIConfig] = useState<AIProviderConfig>(loadAIConfig);

  const updateAIConfig = useCallback((updates: Partial<AIProviderConfig>) => {
    setAIConfig(prev => {
      const next = { ...prev, ...updates };
      // Auto-switch to openai-compatible when both endpoint and key are provided
      if (next.endpoint?.trim() && next.sessionToken?.trim() && next.provider !== 'server-proxy') {
        next.provider = 'openai-compatible';
      }
      saveAIConfig(next);
      return next;
    });
  }, []);

  return (
    <>
      <div className={styles.privacyNotice}>
        <span className="material-symbols-rounded">info</span>
        <div>
          <p className={styles.privacyNotice__text}>
            Pick a provider below, then paste your API key to enable AI writing tools.
            Your key is stored locally in your browser and only sent to the endpoint you specify.
          </p>
        </div>
      </div>
      {isFieldVisible('ai', 'aiEndpoint') && <>
        <div className={styles.field}>
          <label>{highlightMatch('Provider')}</label>
          <div className={styles.aiEndpointPresets}>
            {AI_ENDPOINT_PRESETS.map(preset => {
              const isActive = matchAIPresetId(aiConfig.endpoint) === preset.id;
              return (
                <button
                  key={preset.id}
                  className={`${styles.aiEndpointPreset} ${isActive ? styles['aiEndpointPreset--active'] : ''}`}
                  onClick={() => updateAIConfig({
                    endpoint: preset.endpoint,
                    model: aiConfig.model?.trim() ? aiConfig.model : preset.defaultModel,
                  })}
                >
                  <strong>{preset.label}</strong>
                  <small>{preset.signupUrl}</small>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.field}>
          <label>
            {highlightMatch('API Endpoint')}
            <HelpTooltip text="OpenAI-compatible chat completions endpoint (e.g. https://api.openai.com/v1/chat/completions)" />
          </label>
          <Input
            placeholder="https://api.openai.com/v1/chat/completions"
            value={aiConfig.endpoint || ''}
            onChange={e => updateAIConfig({ endpoint: e.target.value })}
          />
        </div>
      </>}
      {isFieldVisible('ai', 'aiApiKey') && <div className={styles.field}>
        <label>
          {highlightMatch('API Key')}
          <HelpTooltip text="Your API key from OpenAI or any compatible provider" />
        </label>
        <Input
          type="password"
          placeholder={AI_ENDPOINT_PRESETS.find(p => p.id === matchAIPresetId(aiConfig.endpoint))?.keyPlaceholder ?? 'sk-...'}
          value={aiConfig.sessionToken || ''}
          onChange={e => updateAIConfig({ sessionToken: e.target.value })}
        />
      </div>}
      {isFieldVisible('ai', 'aiModel') && <div className={styles.field}>
        <label>
          {highlightMatch('Model')}
          <HelpTooltip text="Model identifier sent with requests (e.g. gpt-4o, gpt-4o-mini, gpt-3.5-turbo)" />
        </label>
        <Input
          placeholder={AI_ENDPOINT_PRESETS.find(p => p.id === matchAIPresetId(aiConfig.endpoint))?.defaultModel ?? 'gpt-4o'}
          value={aiConfig.model || ''}
          onChange={e => updateAIConfig({ model: e.target.value })}
        />
      </div>}
      {aiConfig.endpoint?.trim() && aiConfig.sessionToken?.trim() && (
        <div className={styles.privacyNotice}>
          <span className="material-symbols-rounded" style={{ color: 'var(--success, #22c55e)' }}>check_circle</span>
          <div>
            <p className={styles.privacyNotice__text}>
              AI provider configured. Open <strong>AI Writing Tools</strong> from the menu to start using AI assistance.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
