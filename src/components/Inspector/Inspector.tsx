import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Textarea, IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { countWords, countSentences, countParagraphs, countCharacters, editorToPlainText } from '@/lib/utils';
import { buildNarrativeWeather } from '@/lib/narrativeWeather';
import { analyzeTimelineConsistency } from '@/lib/timelineConsistency';
import { getContinuityMemorySnapshot } from '@/lib/continuityMemory';
import { useResizable } from '@/hooks/useResizable';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import type { Scene } from '@/types';
import type { VoiceSimilarityAlert } from '@/lib/voiceFingerprint';
import { InspectorDetails } from './InspectorDetails';
import { InspectorScenes } from './InspectorScenes';
import { InspectorTimeline } from './InspectorTimeline';
import { InspectorWeather } from './InspectorWeather';
import styles from './Inspector.module.css';

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

interface InspectorProps {
  open: boolean;
  onClose: () => void;
  voiceAlerts?: VoiceSimilarityAlert[];
}

export function Inspector({ open, onClose, voiceAlerts = [] }: InspectorProps) {
  const { state, activeChapter, setActiveChapter, updateChapterImmediate, addScene, updateScene, deleteScene } = useApp();
  const [activeTab, setActiveTab] = useState<'details' | 'scenes' | 'notes' | 'weather' | 'timeline'>('details');

  const inspectorRef = useRef<HTMLElement | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { size, isResizing, handleProps } = useResizable({
    initialSize: 300,
    minSize: 220,
    maxSize: 520,
    direction: 'left',
    persistKey: 'dh-inspector-width',
    disabled: isMobile,
  });

  const isScreenplay = state.projectType === 'screenplay';

  const chapterText = useMemo(() => {
    if (!activeChapter) return '';
    return editorToPlainText(activeChapter.content);
  }, [activeChapter]);

  const chapterWords = useMemo(() => countWords(chapterText), [chapterText]);
  const chapterSentences = useMemo(() => countSentences(chapterText), [chapterText]);
  const chapterParagraphs = useMemo(() => countParagraphs(chapterText), [chapterText]);
  const chapterCharacters = useMemo(() => countCharacters(chapterText), [chapterText]);


  const narrativeWeather = useMemo(() => buildNarrativeWeather(state.chapters), [state.chapters]);
  const timelineConsistency = useMemo(() => analyzeTimelineConsistency(state.chapters, state.novelId), [state.chapters, state.novelId]);
  const [hoveredWeatherChapterId, setHoveredWeatherChapterId] = useState<string | null>(null);

  const weatherFocusPoint = useMemo(() => {
    if (!narrativeWeather.points.length) return null;
    const selectedChapterId = hoveredWeatherChapterId || activeChapter?.id;
    return narrativeWeather.points.find(point => point.chapterId === selectedChapterId) || narrativeWeather.points[0];
  }, [narrativeWeather.points, hoveredWeatherChapterId, activeChapter?.id]);

  const timelineFindings = useMemo(() => timelineConsistency.findings.slice().sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]), [timelineConsistency.findings]);
  const continuityMemory = useMemo(() => getContinuityMemorySnapshot(state.novelId, state.chapters), [state.novelId, state.chapters]);

  const wordGoalProgress = useMemo(() => {
    if (!activeChapter?.wordGoal || activeChapter.wordGoal <= 0) return 0;
    return Math.min(100, Math.round((chapterWords / activeChapter.wordGoal) * 100));
  }, [chapterWords, activeChapter?.wordGoal]);

  // Collect all unique tags across the project for autocomplete
  const allProjectTags = useMemo(() => {
    const tags = new Set<string>();
    state.chapters.forEach(ch => ch.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [state.chapters]);

  // Collect all unique part names across the project for autocomplete
  const allProjectParts = useMemo(() => {
    const parts = new Set<string>();
    state.chapters.forEach(ch => { if (ch.part) parts.add(ch.part); });
    return Array.from(parts).sort();
  }, [state.chapters]);

  const handleFieldChange = useCallback((field: string, value: string | number | string[]) => {
    if (!activeChapter) return;
    updateChapterImmediate(activeChapter.id, { [field]: value });
  }, [activeChapter, updateChapterImmediate]);

  const handleSceneChange = useCallback((sceneId: string, updates: Partial<Scene>) => {
    if (!activeChapter) return;
    updateScene(activeChapter.id, sceneId, updates);
  }, [activeChapter, updateScene]);

  const isMobileDialogOpen = open && isMobile;

  useModalAccessibility({
    enabled: isMobileDialogOpen,
    onRequestClose: onClose,
    containerRef: inspectorRef,
  });

  if (!open) return null;

  const tabs = isScreenplay
    ? [
        { key: 'details' as const, label: 'Scene', icon: 'movie' },
        { key: 'scenes' as const, label: 'Breakdown', icon: 'stacks' },
        { key: 'notes' as const, label: 'Notes', icon: 'sticky_note_2' },
        { key: 'weather' as const, label: 'Weather', icon: 'timeline' },
        { key: 'timeline' as const, label: 'Timeline', icon: 'schedule' },
      ]
    : [
        { key: 'details' as const, label: 'Chapter', icon: 'description' },
        { key: 'scenes' as const, label: 'Scenes', icon: 'stacks' },
        { key: 'notes' as const, label: 'Notes', icon: 'sticky_note_2' },
        { key: 'weather' as const, label: 'Weather', icon: 'timeline' },
        { key: 'timeline' as const, label: 'Timeline', icon: 'schedule' },
      ];

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside
        ref={inspectorRef}
        className={styles.inspector}
        role={isMobileDialogOpen ? 'dialog' : 'complementary'}
        aria-modal={isMobileDialogOpen ? 'true' : undefined}
        aria-label="Inspector"
        tabIndex={isMobileDialogOpen ? -1 : undefined}
        style={!isMobile ? { width: size } : undefined}
      >
        {!isMobile && (
          <div
            className={`${styles.resizeHandle} ${isResizing ? styles['resizeHandle--active'] : ''}`}
            {...handleProps}
          />
        )}
        <div className={styles.header}>
          <div className={styles.tabs} role="tablist" aria-label="Inspector sections">
            {tabs.map(tab => (
              <button
                key={tab.key}
                id={`inspector-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`inspector-panel-${tab.key}`}
                className={`${styles.tab} ${activeTab === tab.key ? styles['tab--active'] : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="material-symbols-rounded">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <Tooltip content="Collapse inspector (Ctrl+Shift+I)" position="left">
            <IconButton icon="chevron_right" label="Collapse inspector" variant="ghost" onClick={onClose} className={styles.closeBtn} />
          </Tooltip>
        </div>

        <div className={styles.body}>
          {!activeChapter ? (
            <div className={styles.empty}>
              <span className="material-symbols-rounded">edit_note</span>
              <p>Select a {isScreenplay ? 'scene' : 'chapter'} to inspect</p>
            </div>
          ) : (
            <>
              {/* CHAPTER / SCENE METADATA TAB */}
              {activeTab === 'details' && (
                <InspectorDetails
                  activeChapter={activeChapter}
                  isScreenplay={isScreenplay}
                  chapterWords={chapterWords}
                  chapterSentences={chapterSentences}
                  chapterParagraphs={chapterParagraphs}
                  chapterCharacters={chapterCharacters}
                  wordGoalProgress={wordGoalProgress}
                  continuityMemory={continuityMemory}
                  voiceAlerts={voiceAlerts}
                  allProjectTags={allProjectTags}
                  allProjectParts={allProjectParts}
                  handleFieldChange={handleFieldChange}
                />
              )}

              {/* SCENES TAB — context-sensitive scene fields */}
              {activeTab === 'scenes' && (
                <InspectorScenes
                  activeChapter={activeChapter}
                  isScreenplay={isScreenplay}
                  handleSceneChange={handleSceneChange}
                  deleteScene={deleteScene}
                  addScene={addScene}
                />
              )}

              {/* NOTES TAB — rich notes + synopsis */}

              {activeTab === 'notes' && (
                <div
                  className={styles.section}
                  role="tabpanel"
                  id="inspector-panel-notes"
                  aria-labelledby="inspector-tab-notes"
                >
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Synopsis</label>
                    <Textarea
                      value={activeChapter.summary}
                      onChange={e => handleFieldChange('summary', e.target.value)}
                      placeholder={`Brief ${isScreenplay ? 'sequence' : 'chapter'} synopsis...`}
                      rows={4}
                    />
                  </div>
                  <div className={styles.notesHint}>
                    <span className="material-symbols-rounded">lightbulb</span>
                    <span>Use the synopsis to capture the essence of this {isScreenplay ? 'scene group' : 'chapter'}. What is the core conflict? What changes by the end?</span>
                  </div>
                </div>
              )}


              {activeTab === 'timeline' && (
                <InspectorTimeline
                  timelineFindings={timelineFindings}
                  timelineConsistency={timelineConsistency}
                  setActiveChapter={setActiveChapter}
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'weather' && (
                <InspectorWeather
                  narrativeWeather={narrativeWeather}
                  weatherFocusPoint={weatherFocusPoint}
                  activeChapter={activeChapter}
                  setHoveredWeatherChapterId={setHoveredWeatherChapterId}
                  setActiveChapter={setActiveChapter}
                />
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
