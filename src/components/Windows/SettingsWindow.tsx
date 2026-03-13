import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Input } from '@/components/UI';
import { useWindowResize } from '@/hooks/useResizable';
import { getManagedPolicy } from '@/lib/policy';
import { SettingsSection } from './settings/SettingsSection';
import { TypographySection } from './settings/TypographySection';
import { AIProviderSection } from './settings/AIProviderSection';
import { SyncSection } from './settings/SyncSection';
import { WritingAssistSection } from './settings/WritingAssistSection';
import { UpdatesSection } from './settings/UpdatesSection';
import { ApplicationSection } from './settings/ApplicationSection';
import { PrivacySection } from './settings/PrivacySection';
import { DataManagementSection } from './settings/DataManagementSection';
import styles from './Windows.module.css';

interface SettingsWindowProps {
  open: boolean;
  onClose: () => void;
}

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
    id: 'updates',
    title: 'Updates',
    keywords: ['release', 'channel', 'stable', 'beta', 'nightly', 'updater'],
    fields: [
      { id: 'releaseChannel', label: 'Release Channel', keywords: ['stable', 'beta', 'nightly'] },
      { id: 'checkUpdates', label: 'Check for Updates', keywords: ['release notes', 'restart'] }
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

const SECTION_ICONS: Record<string, string> = {
  typography: 'text_format',
  ai: 'smart_toy',
  sync: 'cloud_sync',
  assist: 'spellcheck',
  updates: 'system_update',
  app: 'settings',
  privacy: 'shield',
  data: 'database',
};

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
    updates: false,
    privacy: true,
    app: false,
    data: true
  });
  const managedPolicy = useMemo(() => getManagedPolicy(), []);

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
            <SettingsSection
              id="typography"
              title="Typography"
              icon={SECTION_ICONS.typography}
              isCollapsed={!!isSectionCollapsed('typography')}
              onToggle={() => toggleSection('typography')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.typography = el; }}
            >
              <TypographySection
                typography={state.settings.typography}
                updateSettings={updateSettings}
                isFieldVisible={isFieldVisible}
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
          )}

          {/* AI Provider Section */}
          {isSectionVisible('ai') && (
            <SettingsSection
              id="ai"
              title="AI Provider"
              icon={SECTION_ICONS.ai}
              isCollapsed={!!isSectionCollapsed('ai')}
              onToggle={() => toggleSection('ai')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.ai = el; }}
            >
              <AIProviderSection
                isFieldVisible={isFieldVisible}
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
          )}

          {/* Online Sync Section */}
          {isSectionVisible('sync') && (
            <SettingsSection
              id="sync"
              title="Online Sync"
              icon={SECTION_ICONS.sync}
              isCollapsed={!!isSectionCollapsed('sync')}
              onToggle={() => toggleSection('sync')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.sync = el; }}
            >
              <SyncSection
                sync={state.settings.sync}
                updateSettings={updateSettings}
                isFieldVisible={isFieldVisible}
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
          )}

          {/* Writing Assistance Section */}
          {isSectionVisible('assist') && (
            <SettingsSection
              id="assist"
              title="Writing Assistance"
              icon={SECTION_ICONS.assist}
              isCollapsed={!!isSectionCollapsed('assist')}
              onToggle={() => toggleSection('assist')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.assist = el; }}
            >
              <WritingAssistSection
                assist={state.settings.assist}
                updateSettings={updateSettings}
                isFieldVisible={isFieldVisible}
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
          )}

          {/* Updates Section */}
          {isSectionVisible('updates') && (
            <SettingsSection
              id="updates"
              title="Updates"
              icon={SECTION_ICONS.updates}
              isCollapsed={!!isSectionCollapsed('updates')}
              onToggle={() => toggleSection('updates')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.updates = el; }}
            >
              <UpdatesSection
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
          )}

          {/* App Settings Section */}
          {isSectionVisible('app') && (
            <SettingsSection
              id="app"
              title="Application"
              icon={SECTION_ICONS.app}
              isCollapsed={!!isSectionCollapsed('app')}
              onToggle={() => toggleSection('app')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.app = el; }}
            >
              <ApplicationSection
                settings={state.settings}
                updateSettings={updateSettings}
                isFieldVisible={isFieldVisible}
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
          )}

          {/* Privacy & Sync Section */}
          {isSectionVisible('privacy') && (
            <SettingsSection
              id="privacy"
              title="Privacy & Data Sync"
              icon={SECTION_ICONS.privacy}
              isCollapsed={!!isSectionCollapsed('privacy')}
              onToggle={() => toggleSection('privacy')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.privacy = el; }}
            >
              <PrivacySection
                sync={state.settings.sync}
                updateSettings={updateSettings}
                managedPolicy={managedPolicy}
                isFieldVisible={isFieldVisible}
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
          )}

          {/* Data Management Section */}
          {isSectionVisible('data') && (
            <SettingsSection
              id="data"
              title="Data Management"
              icon={SECTION_ICONS.data}
              isCollapsed={!!isSectionCollapsed('data')}
              onToggle={() => toggleSection('data')}
              highlightMatch={highlightMatch}
              sectionRef={el => { sectionRefs.current.data = el; }}
            >
              <DataManagementSection
                isFieldVisible={isFieldVisible}
                highlightMatch={highlightMatch}
              />
            </SettingsSection>
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
