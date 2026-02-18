import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { editorToPlainText, generateId } from '@/lib/utils';
import { loadAIConfig, createProvider } from '@/lib/ai';
import type { AIProviderConfig } from '@/lib/ai';
import { recordTelemetryEvent, isTelemetryOptedIn } from '@/lib/telemetry';
import styles from './Panels.module.css';

interface AISuggestionsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Suggestion {
  id: string;
  type: 'continuation' | 'alternative' | 'grammar' | 'style';
  text: string;
  loading: boolean;
}

const QUICK_ACTIONS = [
  { id: 'continue', label: 'Continue', icon: 'edit_note', type: 'continuation' as const, prompt: 'Continue writing the next 2-3 sentences, matching the tone and style.' },
  { id: 'rephrase', label: 'Rephrase', icon: 'swap_horiz', type: 'alternative' as const, prompt: 'Suggest 2 alternative ways to write the last paragraph.' },
  { id: 'strengthen', label: 'Strengthen', icon: 'bolt', type: 'style' as const, prompt: 'Make the last paragraph more vivid with stronger verbs and sensory details.' },
  { id: 'shorten', label: 'Shorten', icon: 'compress', type: 'style' as const, prompt: 'Tighten the last paragraph to half its length without losing meaning.' },
];

export function AISuggestionsPanel({ open, onClose }: AISuggestionsPanelProps) {
  const { activeChapter, state } = useApp();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const config: AIProviderConfig = loadAIConfig();
  const provider = createProvider(config);
  const isConfigured = provider.isAvailable();

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setLoading(false);
    }
  }, [open]);

  const fetchSuggestion = useCallback(async (prompt: string, type: Suggestion['type'], actionId?: string) => {
    if (!isConfigured || !activeChapter) return;

    const chapterText = editorToPlainText(activeChapter.content);
    const contextSnippet = chapterText.slice(-2000); // Last 2000 chars for context

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const suggestionId = generateId();
    setSuggestions(prev => [...prev, { id: suggestionId, type, text: '', loading: true }]);
    setLoading(true);

    const startTime = Date.now();
    const aiProvider = createProvider(config);

    try {
      const result = await aiProvider.execute({
        action: actionId || type,
        prompt,
        context: contextSnippet,
        projectType: state.projectType,
        sectionTitle: activeChapter.title,
        signal: controller.signal,
      });

      setSuggestions(prev =>
        prev.map(s => s.id === suggestionId ? { ...s, text: result.text, loading: false } : s)
      );

      if (isTelemetryOptedIn()) {
        recordTelemetryEvent({
          action: `inline_${type}`,
          provider: result.provider,
          contextLengthChars: contextSnippet.length,
          promptLengthChars: prompt.length,
          responseLengthChars: result.text.length,
          latencyMs: result.latencyMs,
          success: true,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      setSuggestions(prev =>
        prev.map(s => s.id === suggestionId
          ? { ...s, text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, loading: false }
          : s
        )
      );

      if (isTelemetryOptedIn()) {
        recordTelemetryEvent({
          action: `inline_${type}`,
          provider: config.provider,
          contextLengthChars: 0,
          promptLengthChars: prompt.length,
          responseLengthChars: 0,
          latencyMs: Date.now() - startTime,
          success: false,
          errorType: err instanceof Error ? err.message : 'unknown',
        });
      }
    } finally {
      setLoading(false);
      aiProvider.destroy();
    }
  }, [isConfigured, activeChapter, config, state.projectType]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for Safari insecure contexts
    });
  };

  const handleDismiss = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      fetchSuggestion(customPrompt, 'style');
      setCustomPrompt('');
    }
  };

  if (!open) return null;

  return (
    <div ref={panelRef} className={styles.aiPanel}>
      <div className={styles.aiPanel__header}>
        <h4>
          <span className="material-symbols-rounded">auto_awesome</span>
          AI Suggestions
          {isConfigured && (
            <span className={styles.aiPanel__providerBadge}>
              <span className="material-symbols-rounded">
                {config.provider === 'chrome-ai' ? 'memory' : 'cloud'}
              </span>
            </span>
          )}
        </h4>
        <button className={styles.aiPanel__close} onClick={onClose} aria-label="Close panel">
          <span className="material-symbols-rounded">close</span>
        </button>
      </div>

      {!isConfigured ? (
        <div className={styles.aiPanel__notice}>
          <span className="material-symbols-rounded">info</span>
          <p>
            {config.provider === 'chrome-ai'
              ? 'Chrome AI is not available in this browser. Use Chrome 137+ on a supported platform, or configure an OpenAI-compatible API in AI Writing Tools.'
              : 'AI is not configured. Open AI Writing Tools → Settings → Custom provider (advanced) to connect your own OpenAI-compatible API endpoint and key.'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Quick action buttons */}
          <div className={styles.aiPanel__actions}>
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.id}
                className={styles.aiPanel__actionBtn}
                onClick={() => fetchSuggestion(action.prompt, action.type, action.id)}
                disabled={loading || !activeChapter}
              >
                <span className="material-symbols-rounded">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>

          {/* Custom prompt */}
          <div className={styles.aiPanel__customPrompt}>
            <input
              className={styles.aiPanel__input}
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Ask anything..."
              onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
            />
            <button
              className={styles.aiPanel__sendBtn}
              onClick={handleCustomSubmit}
              disabled={loading || !customPrompt.trim()}
            >
              <span className="material-symbols-rounded">send</span>
            </button>
          </div>

          {/* Suggestions list */}
          <div className={styles.aiPanel__suggestions}>
            {suggestions.map(suggestion => (
              <div key={suggestion.id} className={styles.aiPanel__suggestion}>
                <div className={styles.aiPanel__suggestionHeader}>
                  <span className={styles.aiPanel__suggestionType}>{suggestion.type}</span>
                  <div className={styles.aiPanel__suggestionActions}>
                    {!suggestion.loading && suggestion.text && (
                      <button onClick={() => handleCopy(suggestion.text)} title="Copy">
                        <span className="material-symbols-rounded">content_copy</span>
                      </button>
                    )}
                    <button onClick={() => handleDismiss(suggestion.id)} title="Dismiss">
                      <span className="material-symbols-rounded">close</span>
                    </button>
                  </div>
                </div>
                {suggestion.loading ? (
                  <div className={styles.aiPanel__loading}>Generating...</div>
                ) : (
                  <div className={styles.aiPanel__suggestionText}>{suggestion.text}</div>
                )}
              </div>
            ))}

            {suggestions.length === 0 && (
              <p className={styles.aiPanel__empty}>
                Click a quick action above or type a custom prompt to get AI suggestions for your current {state.projectType === 'screenplay' ? 'scene' : 'chapter'}.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
