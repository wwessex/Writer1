import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Button } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import { AIConfigPanel } from '@/components/AI/AIConfigPanel';
import { clearAllData } from '@/lib/storage';
import { isTelemetryOptedIn, setTelemetryOptIn, clearTelemetryData } from '@/lib/telemetry';
import { loadAIConfig, saveAIConfig, CUSTOM_LLM_DEFAULTS, CUSTOM_LLM_BACKEND_LABELS, testCustomLlmConnection } from '@/lib/ai';
import type { AIProviderConfig, CustomLlmBackend, CustomLlmConfig } from '@/lib/ai';
import { AI_MODE_HELP_TEXT, AI_MODE_LABELS, resolveAIConfigMode, type AIConfigMode } from '@/lib/ai/configUi';
import { useWindowResize } from '@/hooks/useResizable';
import { getManagedPolicy } from '@/lib/policy';
import { validateAiEndpointUrl, validateAuthorizationHeader, validateLocalLlmConfig, validateSyncServerUrl } from '@/lib/validation/settingsValidation';
import { applyUpdateAndRestart, checkForUpdate, deferUpdate, getDeferredUpdateVersion, getLaunchFallbackMessage, getReleaseChannel, setReleaseChannel, type UpdaterSummary } from '@/lib/desktopUpdater';
import type { ReleaseChannel } from '@/lib/updaterGuardrails';
import styles from './Windows.module.css';

interface SettingsWindowProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'de-DE', label: 'German' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'pt-BR', label: 'Portuguese (BR)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'pl-PL', label: 'Polish' },
  { value: 'ru-RU', label: 'Russian' }
];

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'serif', label: 'Serif (Georgia)' },
  { value: 'mono', label: 'Monospace' },
  { value: 'courier-prime', label: 'Courier Prime' },
  { value: 'merriweather', label: 'Merriweather' },
  { value: 'lora', label: 'Lora' }
];

const FONT_SIZE_OPTIONS = [
  { value: '14', label: '14px' },
  { value: '15', label: '15px' },
  { value: '16', label: '16px' },
  { value: '17', label: '17px' },
  { value: '18', label: '18px' },
  { value: '20', label: '20px' },
  { value: '22', label: '22px' }
];

const LINE_HEIGHT_OPTIONS = [
  { value: '1.5', label: 'Compact (1.5)' },
  { value: '1.625', label: 'Normal (1.625)' },
  { value: '1.75', label: 'Relaxed (1.75)' },
  { value: '2', label: 'Spacious (2.0)' },
  { value: '2.25', label: 'Wide (2.25)' }
];

const SETTINGS_SECTIONS = [
  {
    id: 'typography',
    title: 'Typography',
    group: 'general',
    difficulty: 'beginner',
    recommended: true,
    keywords: ['font', 'text', 'line height', 'readability'],
    fields: [
      { id: 'fontFamily', label: 'Font Family', keywords: ['typeface'] },
      { id: 'fontSize', label: 'Font Size', keywords: ['size', 'text scale'] },
      { id: 'lineHeight', label: 'Line Height', keywords: ['spacing', 'leading'] }
    ]
  },
  {
    id: 'sync',
    title: 'Online Sync',
    group: 'privacy-sync',
    difficulty: 'intermediate',
    recommended: false,
    keywords: ['cloud', 'backup', 'server'],
    fields: [
      { id: 'novelId', label: 'Novel ID', keywords: ['identifier', 'sync key'] },
      { id: 'syncUrl', label: 'Sync Server URL', keywords: ['endpoint', 'server url'] },
      { id: 'authHeader', label: 'Authorization Header', keywords: ['token', 'bearer', 'credentials'] }
    ]
  },
  {
    id: 'ai',
    title: 'AI Provider',
    group: 'ai',
    difficulty: 'intermediate',
    recommended: false,
    keywords: ['ai', 'openai', 'api key', 'llm', 'model', 'endpoint', 'gpt', 'claude'],
    fields: [
      { id: 'aiEndpoint', label: 'API Endpoint', keywords: ['url', 'server', 'openai'] },
      { id: 'aiApiKey', label: 'API Key', keywords: ['token', 'secret', 'key', 'session'] },
      { id: 'aiModel', label: 'Model', keywords: ['gpt', 'claude', 'llm', 'gpt-4o'] }
    ]
  },
  {
    id: 'localai',
    title: 'Local AI (Custom LLM)',
    group: 'ai',
    difficulty: 'advanced',
    recommended: true,
    keywords: ['ollama', 'vllm', 'llama', 'local', 'custom', 'self-hosted', 'narratryx'],
    fields: [
      { id: 'localaiBackend', label: 'Backend', keywords: ['ollama', 'vllm', 'llama.cpp'] },
      { id: 'localaiBaseUrl', label: 'Base URL', keywords: ['endpoint', 'url', 'localhost'] },
      { id: 'localaiModel', label: 'Model', keywords: ['model name', 'narratryx'] },
      { id: 'localaiApiKey', label: 'API Key', keywords: ['token', 'secret'] },
    ]
  },
  {
    id: 'assist',
    title: 'Writing Assistance',
    group: 'writing',
    difficulty: 'beginner',
    recommended: true,
    keywords: ['grammar', 'spelling', 'language tool'],
    fields: [
      { id: 'languageToolEnabled', label: 'Enable LanguageTool', keywords: ['toggle', 'grammar check'] },
      { id: 'languageToolUrl', label: 'LanguageTool URL', keywords: ['api', 'endpoint'] },
      { id: 'languageToolLanguage', label: 'Language', keywords: ['locale', 'dictionary'] }
    ]
  },
  {
    id: 'updates',
    title: 'Updates',
    group: 'advanced',
    difficulty: 'intermediate',
    recommended: true,
    keywords: ['release', 'channel', 'stable', 'beta', 'nightly', 'updater'],
    fields: [
      { id: 'releaseChannel', label: 'Release Channel', keywords: ['stable', 'beta', 'nightly'] },
      { id: 'checkUpdates', label: 'Check for Updates', keywords: ['release notes', 'restart'] }
    ]
  },
  {
    id: 'app',
    title: 'Application',
    group: 'general',
    difficulty: 'beginner',
    recommended: true,
    keywords: ['app', 'behaviour', 'productivity'],
    fields: [
      { id: 'autosaveMs', label: 'Autosave (ms)', keywords: ['autosave', 'save delay'] },
      { id: 'dailyWordGoal', label: 'Daily Word Goal', keywords: ['target', 'daily'] },
      { id: 'novelWordGoal', label: 'Novel Word Goal', keywords: ['target', 'project goal'] },
      { id: 'typewriterMode', label: 'Typewriter Mode', keywords: ['scroll', 'cursor', 'centre'] }
    ]
  },
  {
    id: 'privacy',
    title: 'Privacy & Data Sync',
    group: 'privacy-sync',
    difficulty: 'beginner',
    recommended: true,
    keywords: ['privacy', 'telemetry', 'security', 'local storage'],
    fields: [
      { id: 'cloudSync', label: 'Cloud Sync', keywords: ['sync', 'remote'] },
      { id: 'aiUsageTelemetry', label: 'AI Usage Telemetry', keywords: ['metrics', 'tracking'] },
      { id: 'localStorageOnly', label: 'Local Storage Only', keywords: ['offline', 'device'] }
    ]
  },
  {
    id: 'data',
    title: 'Data Management',
    group: 'advanced',
    difficulty: 'advanced',
    recommended: false,
    keywords: ['reset', 'delete', 'storage'],
    fields: [
      { id: 'resetAllData', label: 'Reset All Data', keywords: ['clear', 'remove'] }
    ]
  }
] as const;

const SETTINGS_GROUPS = [
  { id: 'general', title: 'General' },
  { id: 'writing', title: 'Writing' },
  { id: 'ai', title: 'AI' },
  { id: 'privacy-sync', title: 'Privacy & Sync' },
  { id: 'advanced', title: 'Advanced' },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function SettingsWindow({ open, onClose }: SettingsWindowProps) {
  const { state, updateSettings } = useApp();
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const { width, height, startResize, reset: resetSize } = useWindowResize({
    initialWidth: 400,
    initialHeight: 520,
    minWidth: 320,
    maxWidth: 700,
    minHeight: 300,
    maxHeight: 800,
    disabled: isMobile,
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    typography: false,
    ai: false,
    localai: true,
    sync: true,
    assist: true,
    updates: false,
    privacy: true,
    app: false,
    data: true
  });
  const [telemetryEnabled, setTelemetryEnabled] = useState(isTelemetryOptedIn());
  const managedPolicy = useMemo(() => getManagedPolicy(), []);
  const [releaseChannel, setReleaseChannelState] = useState<ReleaseChannel>(() => state.settings.releaseChannel ?? getReleaseChannel());
  const [updateSummary, setUpdateSummary] = useState<UpdaterSummary | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [aiConfig, setAIConfig] = useState<AIProviderConfig>(loadAIConfig);
  const [localLlmTestResult, setLocalLlmTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [localLlmTesting, setLocalLlmTesting] = useState(false);

  const updateAIConfig = useCallback((updates: Partial<AIProviderConfig>) => {
    setAIConfig(prev => {
      const next = { ...prev, ...updates };
      saveAIConfig(next);
      return next;
    });
  }, []);

  const updateCustomLlmConfig = useCallback((updates: Partial<CustomLlmConfig>) => {
    setAIConfig(prev => {
      const currentLlm = prev.customLlm ?? { backend: 'ollama' as CustomLlmBackend, baseUrl: CUSTOM_LLM_DEFAULTS.ollama.baseUrl, model: CUSTOM_LLM_DEFAULTS.ollama.model };
      const next: AIProviderConfig = {
        ...prev,
        provider: 'custom-llm',
        customLlm: { ...currentLlm, ...updates },
      };
      saveAIConfig(next);
      return next;
    });
    setLocalLlmTestResult(null);
  }, []);

  const handleLocalLlmTest = useCallback(async () => {
    const llm = aiConfig.customLlm;
    if (!llm?.baseUrl?.trim() || !llm?.model?.trim()) return;
    setLocalLlmTesting(true);
    setLocalLlmTestResult(null);
    try {
      const result = await testCustomLlmConnection(llm);
      setLocalLlmTestResult(result);
    } catch {
      setLocalLlmTestResult({ ok: false, message: 'Test failed unexpectedly.' });
    } finally {
      setLocalLlmTesting(false);
    }
  }, [aiConfig.customLlm]);

  const customLlm = aiConfig.customLlm;
  const customLlmBackend = customLlm?.backend;
  const customLlmBaseUrl = customLlm?.baseUrl;
  const currentAIMode = resolveAIConfigMode(aiConfig);
  const syncUrlValidation = validateSyncServerUrl(state.settings.sync.url);
  const syncAuthValidation = validateAuthorizationHeader(state.settings.sync.auth);
  const endpointValidation = validateAiEndpointUrl(aiConfig.endpoint ?? '');
  const localLlmValidation = validateLocalLlmConfig({
    baseUrl: aiConfig.customLlm?.baseUrl ?? '',
    model: aiConfig.customLlm?.model ?? '',
  });
  const endpointTestDisabledReason = !aiConfig.sessionToken?.trim()
    ? 'API key is required before testing.'
    : !endpointValidation.valid
      ? endpointValidation.error
      : undefined;

  // Probe non-Ollama backends for connectivity when selected
  useEffect(() => {
    if (aiConfig.provider !== 'custom-llm' || !customLlmBackend || !customLlmBaseUrl?.trim()) return;
    if (customLlmBackend === 'ollama') return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    fetch(`${customLlmBaseUrl.replace(/\/+$/, '')}/v1/models`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          setLocalLlmTestResult({ ok: false, message: `Server returned ${res.status}. Check your configuration.` });
        } else {
          setLocalLlmTestResult({ ok: true, message: `Connected to ${CUSTOM_LLM_BACKEND_LABELS[customLlmBackend]} successfully.` });
        }
      })
      .catch(() => {
        setLocalLlmTestResult({ ok: false, message: `Could not reach ${CUSTOM_LLM_BACKEND_LABELS[customLlmBackend]} at ${customLlmBaseUrl}.` });
      })
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [customLlmBackend, customLlmBaseUrl, aiConfig.provider]);

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const hasSearchQuery = normalizedSearchQuery.length > 0;

  const searchState = useMemo(() => {
    const stateBySection: Record<string, { matchedSection: boolean; matchedFields: Set<string>; hasMatches: boolean }> = {};

    SETTINGS_SECTIONS.forEach(section => {
      if (!hasSearchQuery) {
        stateBySection[section.id] = {
          matchedSection: false,
          matchedFields: new Set(section.fields.map(field => field.id)),
          hasMatches: true,
        };
        return;
      }

      const sectionQuery = `${section.title} ${section.keywords.join(' ')}`.toLowerCase();
      const matchedSection = sectionQuery.includes(normalizedSearchQuery);
      const matchedFields = new Set(
        section.fields
          .filter(field => `${field.label} ${field.keywords.join(' ')}`.toLowerCase().includes(normalizedSearchQuery))
          .map(field => field.id)
      );

      stateBySection[section.id] = {
        matchedSection,
        matchedFields,
        hasMatches: matchedSection || matchedFields.size > 0,
      };
    });

    return stateBySection;
  }, [hasSearchQuery, normalizedSearchQuery]);

  const isFieldVisible = useCallback((sectionId: string, fieldId: string) => {
    if (!hasSearchQuery) return true;
    const sectionState = searchState[sectionId];
    if (!sectionState) return true;
    return sectionState.matchedSection || sectionState.matchedFields.has(fieldId);
  }, [hasSearchQuery, searchState]);

  const isSectionVisible = useCallback((sectionId: string) => {
    if (!hasSearchQuery) return true;
    return searchState[sectionId]?.hasMatches ?? true;
  }, [hasSearchQuery, searchState]);

  const highlightMatch = useCallback((text: string) => {
    if (!hasSearchQuery) return text;
    const index = text.toLowerCase().indexOf(normalizedSearchQuery);
    if (index === -1) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + normalizedSearchQuery.length);
    const after = text.slice(index + normalizedSearchQuery.length);

    return (
      <>
        {before}
        <mark className={styles.searchHighlight}>{match}</mark>
        {after}
      </>
    );
  }, [hasSearchQuery, normalizedSearchQuery]);

  const visibleSections = SETTINGS_SECTIONS.filter(section => isSectionVisible(section.id));
  const sortedVisibleSections = useMemo(() => {
    const difficultyOrder = { beginner: 0, intermediate: 1, advanced: 2 } as const;
    return [...visibleSections].sort((a, b) => {
      const groupDiff =
        SETTINGS_GROUPS.findIndex(group => group.id === a.group) -
        SETTINGS_GROUPS.findIndex(group => group.id === b.group);
      if (groupDiff !== 0) return groupDiff;
      const difficultyDiff = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      if (difficultyDiff !== 0) return difficultyDiff;
      return a.title.localeCompare(b.title);
    });
  }, [visibleSections]);
  const sectionsByGroup = useMemo(() => {
    const byGroup: Record<string, SettingsSection[]> = {};
    SETTINGS_GROUPS.forEach(group => {
      byGroup[group.id] = sortedVisibleSections.filter(section => section.group === group.id);
    });
    return byGroup;
  }, [sortedVisibleSections]);

  useEffect(() => {
    setReleaseChannel(releaseChannel);
    updateSettings({ releaseChannel });
  }, [releaseChannel, updateSettings]);

  useEffect(() => {
    const fallbackMessage = getLaunchFallbackMessage();
    if (fallbackMessage) {
      setUpdateSummary({ available: false, body: fallbackMessage });
    }
  }, []);

  const handleCheckUpdates = async () => {
    setUpdateBusy(true);
    try {
      const summary = await checkForUpdate();
      setUpdateSummary(summary);
      if (!summary.available) {
        window.alert('No eligible update found for this channel.');
      }
    } catch (error) {
      console.error('Update check failed', error);
      window.alert('Update check failed. Guardrails may have switched to fallback mode.');
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleDeferUpdate = () => {
    if (!updateSummary?.version) return;
    deferUpdate(updateSummary.version);
    window.alert(`Deferred update ${updateSummary.version}.`);
  };

  const handleApplyUpdate = async () => {
    setUpdateBusy(true);
    try {
      await applyUpdateAndRestart();
    } catch (error) {
      console.error('Failed to apply update', error);
      window.alert('Failed to apply update. Launch fallback remains active.');
    } finally {
      setUpdateBusy(false);
    }
  };


  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === '/') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && windowRef.current) {
      windowRef.current.style.left = '';
      windowRef.current.style.top = '';
      windowRef.current.style.transform = '';
      resetSize();
    }
  }, [open, resetSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest(`.${styles.resizeHandle}`) || (e.target as HTMLElement).closest(`.${styles.resizeCorner}`)) return;
    if ((e.target as HTMLElement).closest(`.${styles.window__header}`)) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (windowRef.current) {
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        windowRef.current.style.left = `${x}px`;
        windowRef.current.style.top = `${y}px`;
        windowRef.current.style.transform = 'none';
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleResetData = async () => {
    if (confirm('This will delete ALL your data including novels, chapters, and snapshots. This cannot be undone. Continue?')) {
      await clearAllData();
      window.location.reload();
    }
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionCollapsed = useCallback((sectionId: string) => {
    if (hasSearchQuery) return false;
    return collapsedSections[sectionId];
  }, [collapsedSections, hasSearchQuery]);

  const jumpToSection = (sectionId: string) => {
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyRecommendedDefaults = useCallback((groupId: string) => {
    if (groupId === 'general') {
      updateSettings({
        typography: { ...state.settings.typography, fontFamily: 'system', fontSize: 16, lineHeight: 1.625 },
        autosaveMs: 800,
      });
      return;
    }
    if (groupId === 'writing') {
      updateSettings({
        assist: {
          ...state.settings.assist,
          languageToolEnabled: true,
          languageToolUrl: 'https://api.languagetool.org/v2/check',
          languageToolLanguage: 'en-US',
        },
      });
      return;
    }
    if (groupId === 'ai') {
      updateAIConfig({
        endpoint: '',
        sessionToken: '',
        provider: 'custom-llm',
        customLlm: {
          backend: 'ollama',
          baseUrl: CUSTOM_LLM_DEFAULTS.ollama.baseUrl,
          model: CUSTOM_LLM_DEFAULTS.ollama.model,
          apiKey: '',
        },
      });
      return;
    }
    if (groupId === 'privacy-sync') {
      updateSettings({
        sync: { ...state.settings.sync, url: '', auth: '' },
      });
      setTelemetryEnabled(false);
      setTelemetryOptIn(false);
      return;
    }
    if (groupId === 'advanced') {
      setReleaseChannelState('stable');
      return;
    }
  }, [setReleaseChannelState, state.settings.assist, state.settings.sync, state.settings.typography, updateAIConfig, updateSettings]);

  if (!open) return null;

  return (
    <>
      <div
        className={`${styles.backdrop} ${styles['backdrop--visible']}`}
        onClick={onClose}
      />
      <div
        ref={windowRef}
        className={styles.window}
        onMouseDown={handleMouseDown}
        role="dialog"
        aria-label="Settings"
        style={!isMobile ? { width, height } : undefined}
      >
        <div className={styles.window__header}>
          <h3>Settings</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className={styles.window__body}>
          <div className={styles.settingsSearchWrap}>
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search settings…"
              aria-label="Search settings"
            />
          </div>

          {!isMobile && sortedVisibleSections.length > 0 && (
            <nav className={styles.settingsToc} aria-label="Settings sections">
              {sortedVisibleSections.map(section => (
                <button key={section.id} type="button" className={styles.settingsTocLink} onClick={() => jumpToSection(section.id)}>
                  {highlightMatch(section.title)}
                </button>
              ))}
            </nav>
          )}

          <div className={styles.settingsGroups}>
            {SETTINGS_GROUPS.map(group => {
              const groupSections = sectionsByGroup[group.id] ?? [];
              if (groupSections.length === 0) return null;
              const recommendedSections = groupSections.filter(section => section.recommended);
              return (
                <section key={group.id} className={styles.settingsGroupCard}>
                  <div className={styles.settingsGroupHeader}>
                    <h4>{group.title}</h4>
                    <span>{groupSections.length} section{groupSections.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className={styles.recommendedPanel}>
                    <div className={styles.recommendedPanel__title}>Recommended defaults</div>
                    <Button size="small" variant="ghost" onClick={() => applyRecommendedDefaults(group.id)}>
                      Apply {group.title} defaults
                    </Button>
                  </div>
                  <div className={styles.settingsGroupChips}>
                    {recommendedSections.map(section => (
                      <button key={section.id} type="button" className={styles.settingsTocLink} onClick={() => jumpToSection(section.id)}>
                        {section.title}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Typography Section */}
          {isSectionVisible('typography') && (
          <section className={styles.section} ref={el => { sectionRefs.current.typography = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('typography')}>
              <h4>
                <span className="material-symbols-rounded">text_format</span>
                {highlightMatch('Typography')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('typography') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('typography') && (
              <div className={styles.sectionContent}>
                {isFieldVisible('typography', 'fontFamily') && <div className={styles.field}>
                  <label>
                    {highlightMatch('Font Family')}
                    <HelpTooltip text="Choose the typeface for your writing area" />
                  </label>
                  <Select
                    options={FONT_OPTIONS}
                    value={state.settings.typography.fontFamily}
                    onChange={e => updateSettings({
                      typography: { ...state.settings.typography, fontFamily: e.target.value }
                    })}
                  />
                </div>}
                {(isFieldVisible('typography', 'fontSize') || isFieldVisible('typography', 'lineHeight')) && <div className={styles.fieldRow}>
                  {isFieldVisible('typography', 'fontSize') && <div className={styles.field}>
                    <label>{highlightMatch('Font Size')}</label>
                    <Select
                      options={FONT_SIZE_OPTIONS}
                      value={String(state.settings.typography.fontSize)}
                      onChange={e => updateSettings({
                        typography: { ...state.settings.typography, fontSize: parseInt(e.target.value) }
                      })}
                    />
                  </div>}
                  {isFieldVisible('typography', 'lineHeight') && <div className={styles.field}>
                    <label>{highlightMatch('Line Height')}</label>
                    <Select
                      options={LINE_HEIGHT_OPTIONS}
                      value={String(state.settings.typography.lineHeight)}
                      onChange={e => updateSettings({
                        typography: { ...state.settings.typography, lineHeight: parseFloat(e.target.value) }
                      })}
                    />
                  </div>}
                </div>}
              </div>
            )}
          </section>
          )}

          {/* AI Provider Section */}
          {isSectionVisible('ai') && (
          <section className={styles.section} ref={el => { sectionRefs.current.ai = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('ai')}>
              <h4>
                <span className="material-symbols-rounded">smart_toy</span>
                {highlightMatch('AI Provider')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('ai') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('ai') && (
              <div className={styles.sectionContent}>
                <div className={styles.aiModeCard}>
                  <p className={styles.aiModeStatus}>
                    <strong>Current AI Mode:</strong> {AI_MODE_LABELS[currentAIMode]}
                  </p>
                  <div className={styles.aiModeOptions} role="radiogroup" aria-label="Current AI mode">
                    {(['automatic', 'server-provider', 'custom-endpoint', 'local-llm'] as const).map(mode => (
                      <label key={mode} className={styles.aiModeOption}>
                        <input
                          type="radio"
                          name="settings-ai-mode"
                          checked={currentAIMode === mode}
                          onChange={() => {
                            const providerByMode: Record<AIConfigMode, AIProviderConfig['provider']> = {
                              automatic: 'managed-cloud',
                              'server-provider': 'server-proxy',
                              'custom-endpoint': 'openai-compatible',
                              'local-llm': 'custom-llm',
                            };
                            updateAIConfig({ provider: providerByMode[mode] });
                          }}
                        />
                        {AI_MODE_LABELS[mode]}
                      </label>
                    ))}
                  </div>
                  <p className={styles.aiModeHelp}>{AI_MODE_HELP_TEXT[currentAIMode]}</p>
                  {aiConfig.endpoint?.trim() && aiConfig.sessionToken?.trim() && currentAIMode !== 'custom-endpoint' && (
                    <div className={styles.aiModeBanner}>
                      Endpoint + API key detected. Switch to <strong>Custom Endpoint</strong> mode to send requests directly to that endpoint.
                    </div>
                  )}
                </div>
                <AIConfigPanel
                  mode="full"
                  config={aiConfig}
                  onConfigChange={updateAIConfig}
                  onCustomLlmConfigChange={updateCustomLlmConfig}
                  onTestLocalLlm={handleLocalLlmTest}
                  localLlmTestResult={localLlmTestResult}
                  localLlmTesting={localLlmTesting}
                  showProviderFields
                  showLocalFields={false}
                  providerValidation={{
                    endpointError: aiConfig.endpoint?.trim() ? endpointValidation.error : undefined,
                    modelError: aiConfig.endpoint?.trim() && !aiConfig.model?.trim() ? 'Model is required for endpoint testing.' : undefined,
                    testDisabledReason: endpointTestDisabledReason,
                  }}
                />
              </div>
            )}
          </section>
          )}

          {/* Local AI (Custom LLM) Section */}
          {isSectionVisible('localai') && (
          <section className={styles.section} ref={el => { sectionRefs.current.localai = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('localai')}>
              <h4>
                <span className="material-symbols-rounded">memory</span>
                {highlightMatch('Local AI (Custom LLM)')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('localai') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('localai') && (
              <div className={styles.sectionContent}>
                <AIConfigPanel
                  mode="embedded"
                  config={aiConfig}
                  onConfigChange={updateAIConfig}
                  onCustomLlmConfigChange={updateCustomLlmConfig}
                  onTestLocalLlm={handleLocalLlmTest}
                  localLlmTestResult={localLlmTestResult}
                  localLlmTesting={localLlmTesting}
                  showProviderFields={false}
                  showLocalFields
                  localValidation={{
                    baseUrlError: aiConfig.customLlm?.baseUrl?.trim() ? localLlmValidation.baseUrl.error : undefined,
                    modelError: aiConfig.customLlm?.baseUrl?.trim() || aiConfig.customLlm?.model?.trim() ? localLlmValidation.model.error : undefined,
                    testDisabledReason: localLlmValidation.disabledReason,
                  }}
                />
              </div>
            )}
          </section>
          )}

          {/* Online Sync Section */}
          {isSectionVisible('sync') && (
          <section className={styles.section} ref={el => { sectionRefs.current.sync = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('sync')}>
              <h4>
                <span className="material-symbols-rounded">cloud_sync</span>
                {highlightMatch('Online Sync')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('sync') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('sync') && (
              <div className={styles.sectionContent}>
                {isFieldVisible('sync', 'novelId') && <div className={styles.field}>
                  <label>
                    {highlightMatch('Novel ID')}
                    <HelpTooltip text="A unique identifier for syncing this novel across devices" />
                  </label>
                  <Input
                    value={state.settings.sync.novelId}
                    onChange={e => updateSettings({
                      sync: { ...state.settings.sync, novelId: e.target.value }
                    })}
                    placeholder="unique-novel-id"
                  />
                </div>}
                {isFieldVisible('sync', 'syncUrl') && <div className={styles.field}>
                  <label>
                    {highlightMatch('Sync Server URL')}
                    <HelpTooltip text="The endpoint of your sync server for cloud backup" />
                  </label>
                  <Input
                    value={state.settings.sync.url}
                    onChange={e => updateSettings({
                      sync: { ...state.settings.sync, url: e.target.value }
                    })}
                    placeholder="https://your-server.com/sync"
                    aria-invalid={Boolean(syncUrlValidation.error)}
                  />
                  {syncUrlValidation.error && <p className={styles.fieldError}>{syncUrlValidation.error}</p>}
                </div>}
                {isFieldVisible('sync', 'authHeader') && <div className={styles.field}>
                  <label>
                    {highlightMatch('Authorization Header')}
                    <HelpTooltip text="The full Authorization header value sent with sync requests, e.g. 'Bearer your-token-here'" />
                  </label>
                  <Input
                    type="password"
                    value={state.settings.sync.auth}
                    onChange={e => updateSettings({
                      sync: { ...state.settings.sync, auth: e.target.value }
                    })}
                    placeholder="Bearer your-token"
                    aria-invalid={Boolean(syncAuthValidation.error)}
                  />
                  {syncAuthValidation.error && <p className={styles.fieldError}>{syncAuthValidation.error}</p>}
                </div>}
                {(syncUrlValidation.error || syncAuthValidation.error) && (
                  <p className={styles.fieldHelper}>Fix sync field errors before enabling cloud sync.</p>
                )}
              </div>
            )}
          </section>
          )}

          {/* Writing Assistance Section */}
          {isSectionVisible('assist') && (
          <section className={styles.section} ref={el => { sectionRefs.current.assist = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('assist')}>
              <h4>
                <span className="material-symbols-rounded">spellcheck</span>
                {highlightMatch('Writing Assistance')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('assist') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('assist') && (
              <div className={styles.sectionContent}>
                {isFieldVisible('assist', 'languageToolEnabled') && <div className={styles.fieldRow}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={state.settings.assist.languageToolEnabled}
                      onChange={e => updateSettings({
                        assist: { ...state.settings.assist, languageToolEnabled: e.target.checked }
                      })}
                    />
                    <span>{highlightMatch('Enable LanguageTool')}</span>
                    <HelpTooltip text="LanguageTool checks grammar, spelling, and style. The free public API works without an account." position="right" />
                  </label>
                </div>}
                {isFieldVisible('assist', 'languageToolUrl') && <div className={styles.field}>
                  <label>
                    {highlightMatch('LanguageTool URL')}
                    <HelpTooltip text="API endpoint for grammar checking. Use the public server or your own instance." />
                  </label>
                  <Input
                    value={state.settings.assist.languageToolUrl}
                    onChange={e => updateSettings({
                      assist: { ...state.settings.assist, languageToolUrl: e.target.value }
                    })}
                    placeholder="https://api.languagetool.org/v2/check"
                  />
                </div>}
                {isFieldVisible('assist', 'languageToolLanguage') && <div className={styles.field}>
                  <label>{highlightMatch('Language')}</label>
                  <Select
                    options={LANGUAGE_OPTIONS}
                    value={state.settings.assist.languageToolLanguage}
                    onChange={e => updateSettings({
                      assist: { ...state.settings.assist, languageToolLanguage: e.target.value }
                    })}
                  />
                </div>}
              </div>
            )}
          </section>
          )}


          {/* Updates Section */}
          {isSectionVisible('updates') && (
          <section className={styles.section} ref={el => { sectionRefs.current.updates = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('updates')}>
              <h4>
                <span className="material-symbols-rounded">system_update</span>
                {highlightMatch('Updates')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('updates') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('updates') && (
              <div className={styles.sectionContent}>
                <div className={styles.field}>
                  <label>{highlightMatch('Release Channel')}</label>
                  <Select
                    value={releaseChannel}
                    onChange={e => setReleaseChannelState(e.target.value as ReleaseChannel)}
                    options={[
                      { value: 'stable', label: 'Stable' },
                      { value: 'beta', label: 'Beta' },
                      { value: 'nightly', label: 'Nightly' },
                    ]}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <Button onClick={handleCheckUpdates} disabled={updateBusy}>
                    <span className="material-symbols-rounded">update</span>
                    Check for Updates
                  </Button>
                  {updateSummary?.available && (
                    <Button variant="ghost" onClick={handleDeferUpdate} disabled={updateBusy}>
                      <span className="material-symbols-rounded">schedule</span>
                      Defer Install
                    </Button>
                  )}
                </div>
                {updateSummary?.version && (
                  <div className={styles.updateCard}>
                    <p className={styles.updateMeta}>Version {updateSummary.version}</p>
                    {updateSummary.body && <pre className={styles.updateNotes}>{updateSummary.body}</pre>}
                    {getDeferredUpdateVersion() && <p className={styles.updateMeta}>Deferred: {getDeferredUpdateVersion()}</p>}
                    {updateSummary.available && (
                      <Button onClick={handleApplyUpdate} disabled={updateBusy}>
                        <span className="material-symbols-rounded">restart_alt</span>
                        Restart to Apply
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
          )}

          {/* App Settings Section */}
          {isSectionVisible('app') && (
          <section className={styles.section} ref={el => { sectionRefs.current.app = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('app')}>
              <h4>
                <span className="material-symbols-rounded">settings</span>
                {highlightMatch('Application')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('app') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('app') && (
              <div className={styles.sectionContent}>
                {(isFieldVisible('app', 'autosaveMs') || isFieldVisible('app', 'dailyWordGoal')) && <div className={styles.fieldRow}>
                  {isFieldVisible('app', 'autosaveMs') && <div className={styles.field}>
                    <label>
                      {highlightMatch('Autosave (ms)')}
                      <HelpTooltip text="How long to wait after you stop typing before auto-saving" />
                    </label>
                    <Input
                      type="number"
                      value={state.settings.autosaveMs}
                      onChange={e => updateSettings({ autosaveMs: parseInt(e.target.value) || 800 })}
                      min={100}
                      max={5000}
                    />
                  </div>}
                  {isFieldVisible('app', 'dailyWordGoal') && <div className={styles.field}>
                    <label>
                      {highlightMatch('Daily Word Goal')}
                      <HelpTooltip text="Set a daily writing target. Progress is tracked in the Dashboard and status bar." />
                    </label>
                    <Input
                      type="number"
                      value={state.settings.dailyWordGoal || ''}
                      onChange={e => updateSettings({ dailyWordGoal: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>}
                </div>}
                {isFieldVisible('app', 'novelWordGoal') && <div className={styles.field}>
                  <label>
                    {highlightMatch('Novel Word Goal')}
                    <HelpTooltip text="Set an overall word goal for your project. A progress bar appears in the status bar." />
                  </label>
                  <Input
                    type="number"
                    value={state.settings.novelWordGoal || ''}
                    onChange={e => updateSettings({ novelWordGoal: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>}
                <div className={styles.fieldRow}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={state.settings.typewriterMode}
                      onChange={e => updateSettings({ typewriterMode: e.target.checked })}
                    />
                    <span>Typewriter Scroll Mode</span>
                    <HelpTooltip text="Keep the cursor line vertically centered in the editor while typing (Ctrl+Shift+T)" position="right" />
                  </label>
                </div>
              </div>
            )}
          </section>
          )}

          {/* Privacy & Sync Section */}
          {isSectionVisible('privacy') && (
          <section className={styles.section} ref={el => { sectionRefs.current.privacy = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('privacy')}>
              <h4>
                <span className="material-symbols-rounded">shield</span>
                {highlightMatch('Privacy & Data Sync')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('privacy') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('privacy') && (
              <div className={styles.sectionContent}>
                <div className={styles.privacyNotice}>
                  <span className="material-symbols-rounded">info</span>
                  <div>
                    <p className={styles.privacyNotice__text}>
                      <strong>Your writing stays private by default.</strong> DraftHarbour Studio stores everything in
                      your browser's local storage (IndexedDB). No data leaves your device unless you
                      explicitly enable cloud sync below. Diagnostics reports include only metadata and
                      app-state summaries, and automatically redact auth tokens, secrets, and passwords.
                    </p>
                  </div>
                </div>

                {isFieldVisible('privacy', 'cloudSync') && <div className={styles.privacyToggle}>
                  <div className={styles.privacyToggle__info}>
                    <span className={styles.privacyToggle__label}>{highlightMatch('Cloud Sync')}</span>
                    <span className={styles.privacyToggle__desc}>
                      When enabled, chapter content is sent to your configured sync server.
                      Data is transmitted over HTTPS. Enable encrypted sync in Integrations for end-to-end encryption.
                    </span>
                  </div>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={state.settings.sync.url.trim() !== ''}
                      disabled={managedPolicy.forceLocalOnly}
                      onChange={e => {
                        if (!e.target.checked) {
                          updateSettings({ sync: { ...state.settings.sync, url: '', auth: '' } });
                        }
                      }}
                    />
                    <span className={styles.toggleSwitch__slider} />
                  </label>
                </div>}

                {isFieldVisible('privacy', 'aiUsageTelemetry') && <div className={styles.privacyToggle}>
                  <div className={styles.privacyToggle__info}>
                    <span className={styles.privacyToggle__label}>{highlightMatch('AI Usage Telemetry')}</span>
                    <span className={styles.privacyToggle__desc}>
                      Opt in to track your AI usage locally (character counts, latency, action types).
                      No content or text is ever recorded -- only metadata. Data stays on your device.
                    </span>
                  </div>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={telemetryEnabled}
                      disabled={managedPolicy.disableTelemetry}
                      onChange={e => {
                        setTelemetryEnabled(e.target.checked);
                        setTelemetryOptIn(e.target.checked);
                      }}
                    />
                    <span className={styles.toggleSwitch__slider} />
                  </label>
                </div>}

                {telemetryEnabled && (
                  <Button variant="ghost" onClick={() => { clearTelemetryData(); }}>
                    <span className="material-symbols-rounded">delete_sweep</span>
                    Clear Telemetry Data
                  </Button>
                )}

                {isFieldVisible('privacy', 'localStorageOnly') && <div className={styles.privacyToggle}>
                  <div className={styles.privacyToggle__info}>
                    <span className={styles.privacyToggle__label}>{highlightMatch('Local Storage Only')}</span>
                    <span className={styles.privacyToggle__desc}>
                      Grammar checking via LanguageTool sends text to the configured API endpoint.
                      AI Writing Tools sends chapter context to your configured AI endpoint.
                      Both are opt-in and disabled by default.
                    </span>
                  </div>
                  <span className="material-symbols-rounded" style={{ color: 'var(--success, #22c55e)', fontSize: '1.5rem' }}>
                    verified_user
                  </span>
                </div>}
              </div>
            )}
          </section>
          )}

          {/* Data Management Section */}
          {isSectionVisible('data') && (
          <section className={styles.section} ref={el => { sectionRefs.current.data = el; }}>
            <button className={styles.sectionToggle} onClick={() => toggleSection('data')}>
              <h4>
                <span className="material-symbols-rounded">database</span>
                {highlightMatch('Data Management')}
              </h4>
              <span className={`material-symbols-rounded ${styles.sectionChevron}`}>
                {isSectionCollapsed('data') ? 'expand_more' : 'expand_less'}
              </span>
            </button>
            {!isSectionCollapsed('data') && (
              <div className={styles.sectionContent}>
                {isFieldVisible('data', 'resetAllData') && <Button variant="danger" onClick={handleResetData}>
                  <span className="material-symbols-rounded">delete_forever</span>
                  {highlightMatch('Reset All Data')}
                </Button>}
              </div>
            )}
          </section>
          )}
        </div>
        {!isMobile && (
          <>
            <div className={`${styles.resizeHandle} ${styles['resizeHandle--right']}`} onMouseDown={startResize('right')} />
            <div className={`${styles.resizeHandle} ${styles['resizeHandle--bottom']}`} onMouseDown={startResize('bottom')} />
            <div className={styles.resizeCorner} onMouseDown={startResize('bottom-right')} />
          </>
        )}
      </div>
    </>
  );
}
