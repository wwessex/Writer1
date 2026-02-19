import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Button } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import { clearAllData } from '@/lib/storage';
import { isTelemetryOptedIn, setTelemetryOptIn, clearTelemetryData } from '@/lib/telemetry';
import { loadAIConfig, saveAIConfig } from '@/lib/ai';
import type { AIProviderConfig } from '@/lib/ai';
import { useWindowResize } from '@/hooks/useResizable';
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
    keywords: ['ai', 'openai', 'api key', 'llm', 'model', 'endpoint', 'gpt', 'claude'],
    fields: [
      { id: 'aiEndpoint', label: 'API Endpoint', keywords: ['url', 'server', 'openai'] },
      { id: 'aiApiKey', label: 'API Key', keywords: ['token', 'secret', 'key', 'session'] },
      { id: 'aiModel', label: 'Model', keywords: ['gpt', 'claude', 'llm', 'gpt-4o'] }
    ]
  },
  {
    id: 'assist',
    title: 'Writing Assistance',
    keywords: ['grammar', 'spelling', 'language tool'],
    fields: [
      { id: 'languageToolEnabled', label: 'Enable LanguageTool', keywords: ['toggle', 'grammar check'] },
      { id: 'languageToolUrl', label: 'LanguageTool URL', keywords: ['api', 'endpoint'] },
      { id: 'languageToolLanguage', label: 'Language', keywords: ['locale', 'dictionary'] }
    ]
  },
  {
    id: 'app',
    title: 'Application',
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
    keywords: ['reset', 'delete', 'storage'],
    fields: [
      { id: 'resetAllData', label: 'Reset All Data', keywords: ['clear', 'remove'] }
    ]
  }
] as const;

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
    sync: true,
    assist: true,
    privacy: true,
    app: false,
    data: true
  });
  const [telemetryEnabled, setTelemetryEnabled] = useState(isTelemetryOptedIn());
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

          {!isMobile && visibleSections.length > 0 && (
            <nav className={styles.settingsToc} aria-label="Settings sections">
              {visibleSections.map(section => (
                <button key={section.id} type="button" className={styles.settingsTocLink} onClick={() => jumpToSection(section.id)}>
                  {highlightMatch(section.title)}
                </button>
              ))}
            </nav>
          )}

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
                <div className={styles.privacyNotice}>
                  <span className="material-symbols-rounded">info</span>
                  <div>
                    <p className={styles.privacyNotice__text}>
                      Enter your OpenAI-compatible API endpoint and key to enable AI writing tools.
                      Your key is stored locally in your browser and only sent to the endpoint you specify.
                    </p>
                  </div>
                </div>
                {isFieldVisible('ai', 'aiEndpoint') && <div className={styles.field}>
                  <label>
                    {highlightMatch('API Endpoint')}
                    <HelpTooltip text="OpenAI-compatible chat completions endpoint (e.g. https://api.openai.com/v1/chat/completions)" />
                  </label>
                  <Input
                    placeholder="https://api.openai.com/v1/chat/completions"
                    value={aiConfig.endpoint || ''}
                    onChange={e => updateAIConfig({ endpoint: e.target.value })}
                  />
                </div>}
                {isFieldVisible('ai', 'aiApiKey') && <div className={styles.field}>
                  <label>
                    {highlightMatch('API Key')}
                    <HelpTooltip text="Your API key from OpenAI or any compatible provider" />
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-..."
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
                    placeholder="gpt-4o"
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
                  />
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
                  />
                </div>}
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
                      explicitly enable cloud sync below.
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
