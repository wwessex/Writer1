import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Textarea, Button, IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import { countWords, countSentences, countParagraphs, countCharacters, editorToPlainText } from '@/lib/utils';
import { buildNarrativeWeather } from '@/lib/narrativeWeather';
import { analyzeTimelineConsistency } from '@/lib/timelineConsistency';
import { getContinuityMemorySnapshot } from '@/lib/continuityMemory';
import { useResizable } from '@/hooks/useResizable';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import type { ChapterStatus, Scene } from '@/types';
import type { VoiceSimilarityAlert } from '@/lib/voiceFingerprint';
import styles from './Inspector.module.css';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'draft', label: 'Draft' },
  { value: 'revised', label: 'Revised' },
  { value: 'final', label: 'Final' }
];

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
                <div
                  className={styles.section}
                  role="tabpanel"
                  id="inspector-panel-details"
                  aria-labelledby="inspector-tab-details"
                >
                  {/* Word count card */}
                  <div className={styles.statsCard}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{chapterWords.toLocaleString()}</span>
                      <span className={styles.statLabel}>words</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{chapterSentences.toLocaleString()}</span>
                      <span className={styles.statLabel}>sentences</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{chapterParagraphs.toLocaleString()}</span>
                      <span className={styles.statLabel}>paragraphs</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{chapterCharacters.toLocaleString()}</span>
                      <span className={styles.statLabel}>chars</span>
                    </div>
                    {activeChapter.wordGoal > 0 && (
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{wordGoalProgress}%</span>
                        <span className={styles.statLabel}>of goal</span>
                      </div>
                    )}
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{(activeChapter.scenes || []).length}</span>
                      <span className={styles.statLabel}>scenes</span>
                    </div>
                  </div>

                  {activeChapter.wordGoal > 0 && (
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${wordGoalProgress}%` }} />
                    </div>
                  )}

                  {continuityMemory.conflicts.length > 0 && (
                    <div className={styles.statsCard} role="status" aria-live="polite">
                      <div className={styles.stat}>
                        <span className="material-symbols-rounded" style={{ color: 'var(--warning)' }}>rule</span>
                        <span className={styles.statLabel}>Continuity conflicts</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{continuityMemory.conflicts.length}</span>
                        <span className={styles.statLabel}>canonical warnings</span>
                      </div>
                    </div>
                  )}

                  {voiceAlerts.length > 0 && (
                    <div className={styles.statsCard} role="status" aria-live="polite">
                      <div className={styles.stat}>
                        <span className="material-symbols-rounded" style={{ color: 'var(--warning)' }}>warning</span>
                        <span className={styles.statLabel}>Voice overlap risk</span>
                      </div>
                      {voiceAlerts.slice(0, 2).map(alert => (
                        <div key={`${alert.activeSpeaker}-${alert.comparedSpeaker}`} className={styles.stat}>
                          <span className={styles.statValue}>{(alert.similarity * 100).toFixed(0)}%</span>
                          <span className={styles.statLabel}>{alert.activeSpeaker} ↔ {alert.comparedSpeaker}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Synopsis — prominent at the top */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Synopsis</label>
                    <Textarea
                      value={activeChapter.summary}
                      onChange={e => handleFieldChange('summary', e.target.value)}
                      placeholder={`Brief ${isScreenplay ? 'sequence' : 'chapter'} synopsis...`}
                      rows={3}
                    />
                  </div>

                  {/* Status */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Status</label>
                    <Select
                      options={STATUS_OPTIONS}
                      value={activeChapter.status}
                      onChange={e => handleFieldChange('status', e.target.value as ChapterStatus)}
                    />
                  </div>

                  {/* Part — book grouping */}
                  {!isScreenplay && (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Part</label>
                      <Input
                        value={activeChapter.part || ''}
                        onChange={e => handleFieldChange('part', e.target.value)}
                        placeholder="e.g. Part I, Act One"
                        list="part-suggestions"
                      />
                      {allProjectParts.length > 0 && (
                        <datalist id="part-suggestions">
                          {allProjectParts.map(p => <option key={p} value={p} />)}
                        </datalist>
                      )}
                    </div>
                  )}

                  {/* POV / Act */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{isScreenplay ? 'Act' : 'POV Character'}</label>
                    {isScreenplay ? (
                      <Input
                        type="number"
                        value={activeChapter.act || ''}
                        onChange={e => handleFieldChange('act', parseInt(e.target.value) || 1)}
                        placeholder="1"
                      />
                    ) : (
                      <Input
                        value={activeChapter.pov}
                        onChange={e => handleFieldChange('pov', e.target.value)}
                        placeholder="Point of view character"
                      />
                    )}
                  </div>

                  {/* Screenplay-specific: Sequence */}
                  {isScreenplay && (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel}>Sequence</label>
                      <Input
                        type="number"
                        value={activeChapter.sequence || ''}
                        onChange={e => handleFieldChange('sequence', parseInt(e.target.value) || 1)}
                        placeholder="1"
                      />
                    </div>
                  )}

                  {/* Tags with autocomplete */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Tags</label>
                    <Input
                      value={(activeChapter.tags || []).join(', ')}
                      onChange={e => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                      placeholder={isScreenplay ? 'setpiece, flashback' : 'action, romance, cliffhanger'}
                      list="tag-suggestions"
                    />
                    {allProjectTags.length > 0 && (
                      <datalist id="tag-suggestions">
                        {allProjectTags.map(t => <option key={t} value={t} />)}
                      </datalist>
                    )}
                  </div>

                  {/* Word Goal */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{isScreenplay ? 'Page Goal' : 'Word Goal'}</label>
                    <Input
                      type="number"
                      value={activeChapter.wordGoal || ''}
                      onChange={e => handleFieldChange('wordGoal', parseInt(e.target.value) || 0)}
                      placeholder={isScreenplay ? '5' : '2000'}
                    />
                  </div>
                </div>
              )}

              {/* SCENES TAB — context-sensitive scene fields */}
              {activeTab === 'scenes' && (
                <div
                  className={styles.section}
                  role="tabpanel"
                  id="inspector-panel-scenes"
                  aria-labelledby="inspector-tab-scenes"
                >
                  {(activeChapter.scenes || []).map(scene => (
                    <div key={scene.id} className={styles.sceneCard}>
                      <div className={styles.sceneCardHeader}>
                        <Input
                          value={scene.title}
                          onChange={e => handleSceneChange(scene.id, { title: e.target.value })}
                          placeholder={isScreenplay ? 'Scene heading' : 'Scene title'}
                        />
                        <Tooltip content="Delete scene" position="left">
                          <IconButton
                            icon="delete"
                            label="Delete scene"
                            variant="ghost"
                            onClick={() => activeChapter && deleteScene(activeChapter.id, scene.id)}
                          />
                        </Tooltip>
                      </div>
                      <Textarea
                        value={scene.summary}
                        onChange={e => handleSceneChange(scene.id, { summary: e.target.value })}
                        placeholder="What happens in this scene..."
                        rows={2}
                      />
                      <div className={styles.fieldRow}>
                        <div className={styles.field}>
                          <label className={styles.fieldLabel}>Status</label>
                          <Select
                            options={STATUS_OPTIONS}
                            value={scene.status}
                            onChange={e => handleSceneChange(scene.id, { status: e.target.value as ChapterStatus })}
                          />
                        </div>
                      </div>
                      {/* Scene-specific context fields */}
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Location</label>
                        <Input
                          value={scene.location || ''}
                          onChange={e => handleSceneChange(scene.id, { location: e.target.value })}
                          placeholder="Where does this scene take place?"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.fieldLabel}>Characters</label>
                        <Input
                          value={scene.pov || ''}
                          onChange={e => handleSceneChange(scene.id, { pov: e.target.value })}
                          placeholder="Characters in this scene"
                        />
                      </div>
                      {isScreenplay && (
                        <>
                          <div className={styles.fieldRow}>
                            <div className={styles.field}>
                              <label className={styles.fieldLabel}>INT/EXT</label>
                              <Select
                                options={[
                                  { value: 'INT', label: 'INT' },
                                  { value: 'EXT', label: 'EXT' },
                                  { value: 'INT/EXT', label: 'INT/EXT' }
                                ]}
                                value={scene.interiorExterior || 'INT'}
                                onChange={e => handleSceneChange(scene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                              />
                            </div>
                            <div className={styles.field}>
                              <label className={styles.fieldLabel}>Time</label>
                              <Select
                                options={[
                                  { value: 'DAY', label: 'DAY' },
                                  { value: 'NIGHT', label: 'NIGHT' },
                                  { value: 'DAWN', label: 'DAWN' },
                                  { value: 'DUSK', label: 'DUSK' }
                                ]}
                                value={scene.timeOfDay || 'DAY'}
                                onChange={e => handleSceneChange(scene.id, { timeOfDay: e.target.value as Scene['timeOfDay'] })}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <Tooltip content="Add a new scene to this chapter" position="top">
                    <Button variant="ghost" onClick={() => activeChapter && addScene(activeChapter.id)} className={styles.addBtn}>
                      <span className="material-symbols-rounded">add</span>
                      Add Scene
                    </Button>
                  </Tooltip>
                </div>
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
                <div
                  className={styles.section}
                  role="tabpanel"
                  id="inspector-panel-timeline"
                  aria-labelledby="inspector-tab-timeline"
                >
                  <div className={styles.timelineSummary}>
                    <strong>{timelineFindings.length} potential paradox{timelineFindings.length === 1 ? '' : 'es'}</strong>
                    <span>{timelineConsistency.extractedTimelineCount} scenes analyzed</span>
                  </div>
                  {timelineFindings.length === 0 && (
                    <div className={styles.timelineEmpty}>No timeline contradictions detected.</div>
                  )}
                  {timelineFindings.map(finding => (
                    <button
                      type="button"
                      key={finding.id}
                      className={`${styles.timelineFinding} ${styles[`timelineFinding--${finding.severity}`]}`}
                      onClick={() => {
                        const chapterId = finding.involvedChapterIds[0];
                        if (chapterId) setActiveChapter(chapterId);
                        setActiveTab('scenes');
                      }}
                    >
                      <div className={styles.timelineFindingHeader}>
                        <span className={styles.timelineFindingSeverity}>{finding.severity}</span>
                        <span>{finding.type.replaceAll('_', ' ')}</span>
                      </div>
                      <p>{finding.explanation}</p>
                      <span className={styles.timelineFindingMeta}>
                        Chapters: {finding.involvedChapterIds.length} · Scenes: {finding.involvedSceneIds.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'weather' && (
                <div
                  className={styles.section}
                  role="tabpanel"
                  id="inspector-panel-weather"
                  aria-labelledby="inspector-tab-weather"
                >
                  <div className={styles.weatherBandGrid}>
                    {narrativeWeather.climateBands.map(band => (
                      <div key={band.id} className={styles.weatherBand}>
                        <span className={styles.weatherBand__label}>{band.id}</span>
                        <strong>{band.average}</strong>
                        <span>{band.label}</span>
                      </div>
                    ))}
                  </div>

                  {weatherFocusPoint && (
                    <div className={styles.weatherDetails}>
                      <strong>{weatherFocusPoint.chapterTitle}</strong>
                      <span>Sentiment: {weatherFocusPoint.sentimentProxy}</span>
                      <span>Pacing: {weatherFocusPoint.pacingIntensity}</span>
                      <span>Dialogue: {weatherFocusPoint.dialogueDensity}%</span>
                    </div>
                  )}

                  <div className={styles.weatherTimeline}>
                    {narrativeWeather.points.map((point) => {
                      const isActivePoint = point.chapterId === activeChapter?.id;
                      const weatherScore = Math.round((Math.abs(point.sentimentProxy) + point.pacingIntensity + point.dialogueDensity) / 3);
                      return (
                        <button
                          key={point.chapterId}
                          type="button"
                          className={`${styles.weatherPoint} ${isActivePoint ? styles['weatherPoint--active'] : ''}`}
                          onMouseEnter={() => setHoveredWeatherChapterId(point.chapterId)}
                          onMouseLeave={() => setHoveredWeatherChapterId(null)}
                          onFocus={() => setHoveredWeatherChapterId(point.chapterId)}
                          onBlur={() => setHoveredWeatherChapterId(null)}
                          onClick={() => setActiveChapter(point.chapterId)}
                          title={`${point.chapterTitle}
Sentiment ${point.sentimentProxy} | Pacing ${point.pacingIntensity} | Dialogue ${point.dialogueDensity}%`}
                        >
                          <span className={styles.weatherPoint__label}>{point.chapterOrder + 1}. {point.chapterTitle}</span>
                          <div className={styles.weatherPoint__track}>
                            <div className={styles.weatherPoint__fill} style={{ width: `${weatherScore}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
