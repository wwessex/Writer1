import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, Button, Input, Textarea } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import {
  loadAIConfig,
  saveAIConfig,
  createProvider,
  isChromeAIAvailable,
  checkChromeAIAvailability,
} from '@/lib/ai';
import type { AIProviderConfig, AvailabilityStatus } from '@/lib/ai';
import type { ProjectType } from '@/types';
import styles from './Modals.module.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AIWritingModalProps {
  open: boolean;
  onClose: () => void;
}

interface PresetPrompt {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BOOK_PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: 'continue',
    label: 'Continue Writing',
    icon: 'edit_note',
    prompt:
      'Continue writing from where the text left off. Match the tone, style, and pacing of the existing prose. Write the next few paragraphs.'
  },
  {
    id: 'alternatives',
    label: 'Suggest Alternatives',
    icon: 'swap_horiz',
    prompt:
      'Suggest three alternative ways to rewrite the last paragraph of the text. Keep the same meaning but vary the style, word choice, and sentence structure.'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: 'summarize',
    prompt:
      'Provide a concise summary of the chapter text. Highlight the key events, character developments, and themes.'
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: 'unfold_more',
    prompt:
      'Expand on the last section of the text. Add more descriptive detail, sensory language, and internal character thought to deepen the scene.'
  },
  {
    id: 'grammar',
    label: 'Fix Grammar',
    icon: 'spellcheck',
    prompt:
      'Review the text for grammar, spelling, and punctuation errors. List each issue found with the original text, the correction, and a brief explanation.'
  }
];

const SCREENPLAY_PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: 'dialogueAlternatives',
    label: 'Generate Dialogue Alternatives',
    icon: 'record_voice_over',
    prompt:
      'Generate scene dialogue alternatives for the latest dialogue exchange. Keep each option true to the character voices and scene tension.'
  },
  {
    id: 'tightenAction',
    label: 'Tighten Action Lines',
    icon: 'compress',
    prompt:
      'Tighten action lines in this scene for pace and clarity. Keep visual language concise, cinematic, and production-ready.'
  },
  {
    id: 'beatToDraft',
    label: 'Beat Outline to Scene Draft',
    icon: 'movie',
    prompt:
      'Turn this beat outline into a screenplay scene draft. Preserve the scene objective, escalate conflict, and include action + dialogue blocks.'
  },
  {
    id: 'continuityPass',
    label: 'Continuity Check',
    icon: 'rule',
    prompt:
      'Review this scene for screenplay continuity issues (character intent, props, entrances/exits, timing). List issues and propose fixes.'
  },
  {
    id: 'punchUp',
    label: 'Punch Up Scene',
    icon: 'bolt',
    prompt:
      'Punch up this scene with stronger subtext and sharper turns while preserving story intent and character objectives.'
  }
];

const BOOK_CHAPTER_TEMPLATE = `# Chapter Title

## Scene Goal
- What changes by the end of this chapter?

## Opening Beat
Set the location, mood, and immediate conflict.

## Complication
Escalate pressure with a choice, reveal, or obstacle.

## Turning Point
Land the emotional or plot shift that propels the next section.`;

const SCREENPLAY_SCENE_TEMPLATE = `INT./EXT. LOCATION - DAY/NIGHT

Action: Describe only what is visible and audible on screen.

CHARACTER NAME
Dialogue line.

CHARACTER NAME
(optional parenthetical)
Response line.

Action: End on a visual turn, reveal, or decision.`;

function getPresetPrompts(projectType: ProjectType): PresetPrompt[] {
  return projectType === 'screenplay' ? SCREENPLAY_PRESET_PROMPTS : BOOK_PRESET_PROMPTS;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AIWritingModal({ open, onClose }: AIWritingModalProps) {
  const { activeChapter, state } = useApp();
  const { showToast } = useToast();
  const isScreenplay = state.projectType === 'screenplay';
  const presetPrompts = useMemo(() => getPresetPrompts(state.projectType), [state.projectType]);

  // AI configuration (provider-aware)
  const [config, setConfig] = useState<AIProviderConfig>(loadAIConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Chrome AI availability
  const [chromeAIAvailable, setChromeAIAvailable] = useState(false);
  const [chromeAIStatus, setChromeAIStatus] = useState<AvailabilityStatus>('unknown');

  // Prompt / response state
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for aborting in-flight requests
  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // Persist config changes
  const updateConfig = useCallback((updates: Partial<AIProviderConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      saveAIConfig(next);
      return next;
    });
  }, []);

  // Detect Chrome AI availability on mount
  useEffect(() => {
    isChromeAIAvailable().then(available => {
      setChromeAIAvailable(available);
      if (available) {
        checkChromeAIAvailability().then(result => {
          // Use the best status across all APIs
          const statuses = Object.values(result);
          if (statuses.includes('readily')) setChromeAIStatus('readily');
          else if (statuses.includes('after-download')) setChromeAIStatus('after-download');
          else setChromeAIStatus('no');
        });
      } else {
        setChromeAIStatus('no');
      }
    });
  }, []);

  /* ----- Provider logic --------------------------------------------- */

  const isConfigured =
    config.provider === 'chrome-ai'
      ? chromeAIAvailable
      : !!(config.endpoint?.trim() && config.apiKey?.trim());

  // Reset transient state when the modal opens/closes
  useEffect(() => {
    if (open) {
      setResponse('');
      setError(null);
      setPrompt('');
      setLoading(false);
      // Auto-open settings panel when AI is not configured
      if (!isConfigured) {
        setShowSettings(true);
      }
    } else {
      abortRef.current?.abort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll response area when new content arrives
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  const sendPrompt = useCallback(
    async (promptText: string, presetId?: string) => {
      if (!promptText.trim()) return;

      if (!isConfigured) {
        setError(
          config.provider === 'chrome-ai'
            ? 'Chrome AI is not available in this browser. Switch to OpenAI-Compatible API in Settings, or use Chrome 137+ on a supported platform.'
            : 'AI is not configured yet. Open Settings to set your API endpoint and API key.'
        );
        return;
      }

      const chapterText = activeChapter
        ? editorToPlainText(activeChapter.content)
        : '';

      // Abort any previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setResponse('');

      const provider = createProvider(config);

      try {
        const result = await provider.execute({
          action: presetId || 'custom',
          prompt: promptText,
          context: chapterText,
          projectType: state.projectType,
          sectionTitle: activeChapter?.title,
          signal: controller.signal,
        });

        setResponse(result.text);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(message);
      } finally {
        setLoading(false);
        provider.destroy();
      }
    },
    [activeChapter, config, isConfigured, state.projectType]
  );

  const handleSubmit = () => {
    sendPrompt(prompt);
  };

  const handlePreset = (preset: PresetPrompt) => {
    setPrompt(preset.prompt);
    sendPrompt(preset.prompt, preset.id);
  };

  const handleCopyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response).then(() => {
        showToast('Response copied to clipboard', 'success', 'content_copy');
      }).catch(() => {
        showToast('Failed to copy to clipboard', 'error');
      });
    }
  };

  const handleTestConnection = async () => {
    if (!config.endpoint?.trim() || !config.apiKey?.trim()) {
      showToast('Enter both an API endpoint and API key first', 'warning');
      return;
    }
    setTestingConnection(true);
    try {
      const res = await fetch(config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o',
          messages: [
            { role: 'user', content: 'Say "Connection successful" in exactly two words.' }
          ],
          max_tokens: 10
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        showToast('Connection successful', 'success', 'check_circle');
      } else {
        const body = await res.text().catch(() => '');
        showToast(`Connection failed (${res.status}): ${body.slice(0, 100) || res.statusText}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Connection failed: ${message}`, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  /* ----- Helpers ---------------------------------------------------- */

  const providerLabel = config.provider === 'chrome-ai' ? 'Chrome AI' : 'API';
  const providerIcon = config.provider === 'chrome-ai' ? 'memory' : 'cloud';

  /* ----- Render ----------------------------------------------------- */

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="AI Writing Tools"
      size="large"
      footer={
        <div className={styles.aiFooter}>
          <div className={styles.aiFooterLeft}>
            <Button
              variant="ghost"
              onClick={() => setShowSettings(s => !s)}
            >
              <span className="material-symbols-rounded">settings</span>
              {showSettings ? 'Hide Settings' : 'Settings'}
            </Button>
            <span className={styles.aiProviderIndicator}>
              <span className="material-symbols-rounded">{providerIcon}</span>
              {providerLabel}
            </span>
          </div>
          <div className={styles.aiFooterRight}>
            {response && (
              <Button variant="ghost" onClick={handleCopyResponse}>
                <span className="material-symbols-rounded">content_copy</span>
                Copy
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
            >
              <span className="material-symbols-rounded">send</span>
              {loading ? 'Generating...' : 'Send'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className={styles.aiSettings}>
          <h4>
            <span className="material-symbols-rounded">tune</span>
            AI Configuration
          </h4>

          {/* Provider selector */}
          <div className={styles.aiProviderSelector}>
            <label className={styles.aiLabel}>AI Provider</label>
            <div className={styles.aiProviderOptions}>
              <button
                className={`${styles.aiProviderOption} ${
                  config.provider === 'chrome-ai' ? styles['aiProviderOption--active'] : ''
                }`}
                onClick={() => updateConfig({ provider: 'chrome-ai' })}
                disabled={!chromeAIAvailable}
              >
                <span className="material-symbols-rounded">memory</span>
                <span className={styles.aiProviderOptionText}>
                  <strong>Chrome Built-in AI</strong>
                  <small>Free, on-device, no API key needed</small>
                </span>
                {chromeAIStatus === 'readily' && (
                  <span className={styles.aiBadge} data-status="ready">Ready</span>
                )}
                {chromeAIStatus === 'after-download' && (
                  <span className={styles.aiBadge} data-status="download">Download needed</span>
                )}
                {chromeAIStatus === 'no' && (
                  <span className={styles.aiBadge} data-status="unavailable">Not available</span>
                )}
              </button>
              <button
                className={`${styles.aiProviderOption} ${
                  config.provider === 'openai-compatible' ? styles['aiProviderOption--active'] : ''
                }`}
                onClick={() => updateConfig({ provider: 'openai-compatible' })}
              >
                <span className="material-symbols-rounded">cloud</span>
                <span className={styles.aiProviderOptionText}>
                  <strong>OpenAI-Compatible API</strong>
                  <small>OpenAI, Anthropic, Ollama, LM Studio</small>
                </span>
              </button>
            </div>
          </div>

          {/* OpenAI-compatible settings (only shown when that provider is selected) */}
          {config.provider === 'openai-compatible' && (
            <>
              <div className={styles.aiSettingsFields}>
                <label className={styles.aiLabel}>
                  API Endpoint
                  <Input
                    placeholder="https://api.openai.com/v1/chat/completions"
                    value={config.endpoint || ''}
                    onChange={e => updateConfig({ endpoint: e.target.value })}
                  />
                </label>
                <label className={styles.aiLabel}>
                  API Key
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={config.apiKey || ''}
                    onChange={e => updateConfig({ apiKey: e.target.value })}
                  />
                </label>
              </div>
              <div className={styles.aiSettingsActions}>
                <Button
                  variant="default"
                  size="small"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !config.endpoint?.trim() || !config.apiKey?.trim()}
                >
                  <span className="material-symbols-rounded">wifi_tethering</span>
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
              <div className={styles.aiPrivacyNote}>
                <span className="material-symbols-rounded">shield</span>
                <span>Your API key is stored only in your browser&apos;s localStorage and is sent only to the endpoint you configure. No data is shared with DraftHarbour Studio servers.</span>
              </div>
            </>
          )}

          {/* Chrome AI info */}
          {config.provider === 'chrome-ai' && chromeAIAvailable && (
            <div className={styles.aiPrivacyNote}>
              <span className="material-symbols-rounded">shield</span>
              <span>Chrome AI runs entirely on your device. Your writing never leaves your computer.</span>
            </div>
          )}

          <p className={styles.aiSettingsHint}>
            Settings are stored locally in your browser.
          </p>
        </div>
      )}

      {/* Unconfigured notice */}
      {!isConfigured && !showSettings && (
        <div className={styles.aiNotice}>
          <span className="material-symbols-rounded">info</span>
          <div>
            {config.provider === 'chrome-ai' ? (
              <>
                <strong>Chrome AI is not available in this browser.</strong>{' '}
                Use Chrome 137+ on a supported platform for free on-device AI, or open{' '}
                <button className={styles.aiNoticeLink} onClick={() => setShowSettings(true)}>
                  Settings
                </button>{' '}
                to configure an OpenAI-compatible API instead.
              </>
            ) : (
              <>
                <strong>AI is not configured yet.</strong> Open{' '}
                <button className={styles.aiNoticeLink} onClick={() => setShowSettings(true)}>
                  Settings
                </button>{' '}
                to enter your API endpoint and API key.
                <br /><br />
                <strong>Compatible services:</strong> OpenAI, Anthropic (via proxy), Ollama, LM Studio, or any OpenAI-compatible API.
                <br />
                <strong>Example endpoint:</strong>{' '}
                <code className={styles.aiCode}>https://api.openai.com/v1/chat/completions</code>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preset prompts */}
      <div className={styles.aiPresets}>
        {presetPrompts.map(preset => (
          <button
            key={preset.id}
            className={styles.aiPresetBtn}
            onClick={() => handlePreset(preset)}
            disabled={loading}
          >
            <span className="material-symbols-rounded">{preset.icon}</span>
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom prompt input */}
      <div className={styles.aiPromptArea}>
        <Textarea
          placeholder={
            isScreenplay
              ? "Enter a custom prompt... (e.g. 'Punch up the subtext in this exchange')"
              : "Enter a custom prompt... (e.g. 'Rewrite this scene from a different POV')"
          }
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        {activeChapter && (
          <p className={styles.aiContextHint}>
            <span className="material-symbols-rounded">auto_awesome</span>
            Context: {activeChapter.title} and relevant {isScreenplay ? 'scene structure' : 'chapter details'} will be sent with your prompt.
          </p>
        )}
        <div className={styles.aiPresets}>
          <button
            className={styles.aiPresetBtn}
            onClick={() => setPrompt(BOOK_CHAPTER_TEMPLATE)}
            disabled={loading}
          >
            <span className="material-symbols-rounded">auto_stories</span>
            Insert Book Chapter Template
          </button>
          <button
            className={styles.aiPresetBtn}
            onClick={() => setPrompt(SCREENPLAY_SCENE_TEMPLATE)}
            disabled={loading}
          >
            <span className="material-symbols-rounded">theaters</span>
            Insert Screenplay Scene Template
          </button>
        </div>
      </div>

      {/* Response area */}
      {(response || loading || error) && (
        <div className={styles.aiResponseArea}>
          <h4>
            <span className="material-symbols-rounded">smart_toy</span>
            Response
          </h4>
          {loading && (
            <p className={styles.loadingText}>
              {config.provider === 'chrome-ai' && chromeAIStatus === 'after-download'
                ? 'Downloading AI model...'
                : 'Generating response...'}
            </p>
          )}
          {error && <p className={styles.aiError}>{error}</p>}
          {response && (
            <div ref={responseRef} className={styles.aiResponseContent}>
              {response}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
