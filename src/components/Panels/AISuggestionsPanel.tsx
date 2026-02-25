import { useState, useCallback, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useApp } from '@/context/AppContext';
import { editorToPlainText, generateId } from '@/lib/utils';
import { loadAIConfig, createProvider } from '@/lib/ai';
import type { AIProviderConfig } from '@/lib/ai';
import { recordTelemetryEvent, isTelemetryOptedIn } from '@/lib/telemetry';
import styles from './Panels.module.css';

interface AISuggestionsPanelProps {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
}

interface Suggestion {
  id: string;
  type: 'continuation' | 'alternative' | 'grammar' | 'style';
  text: string;
  loading: boolean;
}

type SectionKey = 'quickActions' | 'rewrite' | 'brainstorm';

const QUICK_ACTIONS = [
  { id: 'continue', label: 'Continue', icon: 'edit_note', type: 'continuation' as const, prompt: 'Continue writing the next 2-3 sentences, matching the tone and style.' },
  { id: 'rephrase', label: 'Rephrase', icon: 'swap_horiz', type: 'alternative' as const, prompt: 'Suggest 2 alternative ways to write the last paragraph.' },
  { id: 'strengthen', label: 'Strengthen', icon: 'bolt', type: 'style' as const, prompt: 'Make the last paragraph more vivid with stronger verbs and sensory details.' },
  { id: 'shorten', label: 'Shorten', icon: 'compress', type: 'style' as const, prompt: 'Tighten the last paragraph to half its length without losing meaning.' },
];

const REWRITE_ACTIONS = [
  { id: 'rewrite-formal', label: 'Formal', icon: 'school', type: 'alternative' as const,
    prompt: (text: string) => `Rewrite the following text in a more formal, professional tone. Keep the same meaning:\n\n"${text}"` },
  { id: 'rewrite-casual', label: 'Casual', icon: 'chat_bubble', type: 'alternative' as const,
    prompt: (text: string) => `Rewrite the following text in a casual, conversational tone. Keep the same meaning:\n\n"${text}"` },
  { id: 'rewrite-vivid', label: 'Vivid', icon: 'palette', type: 'style' as const,
    prompt: (text: string) => `Rewrite the following text with vivid sensory details, strong verbs, and evocative imagery:\n\n"${text}"` },
  { id: 'rewrite-concise', label: 'Concise', icon: 'compress', type: 'style' as const,
    prompt: (text: string) => `Rewrite the following text as concisely as possible, keeping only the essential meaning:\n\n"${text}"` },
];

const BRAINSTORM_ACTIONS = [
  { id: 'brainstorm-plot', label: 'Plot Ideas', icon: 'auto_stories', type: 'continuation' as const,
    prompt: 'Based on the story so far, suggest 3 interesting plot developments that could happen next. Be creative and unexpected.' },
  { id: 'brainstorm-arc', label: 'Character Arc', icon: 'person', type: 'continuation' as const,
    prompt: 'Based on the current chapter, suggest how the point-of-view character could grow or change. Outline a brief character arc with 3 key emotional beats.' },
  { id: 'brainstorm-outline', label: 'Scene Outline', icon: 'format_list_numbered', type: 'continuation' as const,
    prompt: 'Create a detailed beat-by-beat outline for the current scene. Include 5-7 story beats with brief descriptions of what happens in each.' },
  { id: 'brainstorm-whatif', label: 'What If...', icon: 'help', type: 'continuation' as const,
    prompt: 'Generate 3 creative "what if" scenarios for this story. Each should be a surprising twist or alternative direction that would change the story in an interesting way.' },
];

export function AISuggestionsPanel({ open, onClose, editor }: AISuggestionsPanelProps) {
  const { activeChapter, state } = useApp();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    quickActions: true,
    rewrite: true,
    brainstorm: true,
  });
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const config: AIProviderConfig = loadAIConfig();
  const provider = createProvider(config);
  const isConfigured = provider.isAvailable();

  const selectedText = editor?.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
    ' '
  ) || '';

  const hasSelection = selectedText.trim().length > 0;

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setLoading(false);
    }
  }, [open]);

  const toggleSection = useCallback((section: SectionKey) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

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

  const handleRewriteAction = (action: typeof REWRITE_ACTIONS[number]) => {
    if (!hasSelection) return;
    fetchSuggestion(action.prompt(selectedText), action.type, action.id);
  };

  const handleBrainstormAction = (action: typeof BRAINSTORM_ACTIONS[number]) => {
    fetchSuggestion(action.prompt, action.type, action.id);
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
                {config.provider === 'chrome-ai' ? 'memory' : config.provider === 'server-proxy' ? 'dns' : 'cloud'}
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
              : config.provider === 'server-proxy'
                ? 'Enter your API key in AI Writing Tools → Settings to connect directly to the selected provider.'
                : 'AI is not configured. Open AI Writing Tools → Settings, pick a provider (e.g. OpenAI, Groq, OpenRouter), and paste your API key.'
            }
          </p>
        </div>
      ) : (
        <div className={styles.aiPanel__body}>
          {/* Quick Actions section */}
          <div className={styles.aiPanel__section}>
            <button
              className={styles.aiPanel__sectionHeader}
              onClick={() => toggleSection('quickActions')}
              aria-expanded={expandedSections.quickActions}
            >
              <span className="material-symbols-rounded">
                {expandedSections.quickActions ? 'expand_less' : 'expand_more'}
              </span>
              Quick Actions
            </button>
            {expandedSections.quickActions && (
              <div className={styles.aiPanel__sectionContent}>
                <div className={styles.aiPanel__actionGrid}>
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
              </div>
            )}
          </div>

          {/* Rewrite section */}
          <div className={styles.aiPanel__section}>
            <button
              className={styles.aiPanel__sectionHeader}
              onClick={() => toggleSection('rewrite')}
              aria-expanded={expandedSections.rewrite}
            >
              <span className="material-symbols-rounded">
                {expandedSections.rewrite ? 'expand_less' : 'expand_more'}
              </span>
              Rewrite Tools
            </button>
            {expandedSections.rewrite && (
              <div className={styles.aiPanel__sectionContent}>
                {!hasSelection && (
                  <p className={styles.aiPanel__disabledHint}>
                    <span className="material-symbols-rounded">info</span>
                    Select text in the editor to use rewrite tools
                  </p>
                )}
                <div className={styles.aiPanel__actionGrid}>
                  {REWRITE_ACTIONS.map(action => (
                    <button
                      key={action.id}
                      className={styles.aiPanel__actionBtn}
                      onClick={() => handleRewriteAction(action)}
                      disabled={loading || !activeChapter || !hasSelection}
                    >
                      <span className="material-symbols-rounded">{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Brainstorm section */}
          <div className={styles.aiPanel__section}>
            <button
              className={styles.aiPanel__sectionHeader}
              onClick={() => toggleSection('brainstorm')}
              aria-expanded={expandedSections.brainstorm}
            >
              <span className="material-symbols-rounded">
                {expandedSections.brainstorm ? 'expand_less' : 'expand_more'}
              </span>
              Brainstorm
            </button>
            {expandedSections.brainstorm && (
              <div className={styles.aiPanel__sectionContent}>
                <div className={styles.aiPanel__actionGrid}>
                  {BRAINSTORM_ACTIONS.map(action => (
                    <button
                      key={action.id}
                      className={styles.aiPanel__actionBtn}
                      onClick={() => handleBrainstormAction(action)}
                      disabled={loading || !activeChapter}
                    >
                      <span className="material-symbols-rounded">{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
        </div>
      )}
    </div>
  );
}
