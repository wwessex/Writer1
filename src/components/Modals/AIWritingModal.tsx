import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, Button, Input, Textarea } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import styles from './Modals.module.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AIWritingModalProps {
  open: boolean;
  onClose: () => void;
}

interface AIConfig {
  endpoint: string;
  apiKey: string;
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

const STORAGE_KEY = 'novelwriter_ai_config';

const PRESET_PROMPTS: PresetPrompt[] = [
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIConfig>;
      return {
        endpoint: parsed.endpoint || '',
        apiKey: parsed.apiKey || ''
      };
    }
  } catch {
    // Ignore corrupt data
  }
  return { endpoint: '', apiKey: '' };
}

function saveConfig(config: AIConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AIWritingModal({ open, onClose }: AIWritingModalProps) {
  const { activeChapter } = useApp();

  // AI configuration
  const [config, setConfig] = useState<AIConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);

  // Prompt / response state
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for aborting in-flight requests
  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // Persist config changes
  const updateConfig = useCallback((updates: Partial<AIConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      saveConfig(next);
      return next;
    });
  }, []);

  // Reset transient state when the modal opens
  useEffect(() => {
    if (open) {
      setResponse('');
      setError(null);
      setPrompt('');
      setLoading(false);
    } else {
      // Cancel any in-flight request when modal closes
      abortRef.current?.abort();
    }
  }, [open]);

  // Scroll response area when new content arrives
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  /* ----- API call ------------------------------------------------- */

  const isConfigured = config.endpoint.trim() !== '' && config.apiKey.trim() !== '';

  const sendPrompt = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;

      if (!isConfigured) {
        setError(
          'AI is not configured yet. Open Settings in this modal to set your API endpoint and API key.'
        );
        return;
      }

      // Build context from the active chapter
      const chapterText = activeChapter
        ? editorToPlainText(activeChapter.content)
        : '';

      const fullPrompt = chapterText
        ? `Here is the current chapter text for context:\n\n---\n${chapterText}\n---\n\n${promptText}`
        : promptText;

      // Abort any previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setResponse('');

      try {
        const res = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful creative writing assistant. Respond in plain text with clear formatting.'
              },
              { role: 'user', content: fullPrompt }
            ],
            max_tokens: 2048
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(
            `API request failed (${res.status}): ${body || res.statusText}`
          );
        }

        const data = await res.json();

        // Handle OpenAI-compatible response shape
        const text =
          data?.choices?.[0]?.message?.content ??
          data?.content?.[0]?.text ??
          data?.response ??
          JSON.stringify(data, null, 2);

        setResponse(text);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled; nothing to show
          return;
        }
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [activeChapter, config, isConfigured]
  );

  const handleSubmit = () => {
    sendPrompt(prompt);
  };

  const handlePreset = (preset: PresetPrompt) => {
    setPrompt(preset.prompt);
    sendPrompt(preset.prompt);
  };

  const handleCopyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response).catch(() => {
        // Clipboard API may not be available
      });
    }
  };

  /* ----- Render --------------------------------------------------- */

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="AI Writing Tools"
      size="large"
      footer={
        <div className={styles.aiFooter}>
          <Button
            variant="ghost"
            onClick={() => setShowSettings(s => !s)}
          >
            <span className="material-symbols-rounded">settings</span>
            {showSettings ? 'Hide Settings' : 'Settings'}
          </Button>
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
            API Configuration
          </h4>
          <div className={styles.aiSettingsFields}>
            <label className={styles.aiLabel}>
              API Endpoint
              <Input
                placeholder="https://api.openai.com/v1/chat/completions"
                value={config.endpoint}
                onChange={e => updateConfig({ endpoint: e.target.value })}
              />
            </label>
            <label className={styles.aiLabel}>
              API Key
              <Input
                type="password"
                placeholder="sk-..."
                value={config.apiKey}
                onChange={e => updateConfig({ apiKey: e.target.value })}
              />
            </label>
          </div>
          <p className={styles.aiSettingsHint}>
            Settings are stored locally in your browser. The endpoint should
            accept OpenAI-compatible chat completion requests.
          </p>
        </div>
      )}

      {/* Unconfigured notice */}
      {!isConfigured && !showSettings && (
        <div className={styles.aiNotice}>
          <span className="material-symbols-rounded">info</span>
          <div>
            <strong>AI is not configured.</strong> Click{' '}
            <em>Settings</em> below to enter your API endpoint and API key.
            This feature works with any OpenAI-compatible API (OpenAI, Ollama,
            LM Studio, etc.). Your credentials are stored only in your
            browser&apos;s localStorage.
          </div>
        </div>
      )}

      {/* Preset prompts */}
      <div className={styles.aiPresets}>
        {PRESET_PROMPTS.map(preset => (
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
          placeholder="Enter a custom prompt... (e.g. 'Rewrite this scene from a different POV')"
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
            Context: {activeChapter.title} will be sent along with your prompt.
          </p>
        )}
      </div>

      {/* Response area */}
      {(response || loading || error) && (
        <div className={styles.aiResponseArea}>
          <h4>
            <span className="material-symbols-rounded">smart_toy</span>
            Response
          </h4>
          {loading && (
            <p className={styles.loadingText}>Generating response...</p>
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
