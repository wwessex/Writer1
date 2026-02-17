import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Textarea, Button, IconButton } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { countWords, countSentences, countParagraphs, countCharacters, editorToPlainText } from '@/lib/utils';
import { useResizable } from '@/hooks/useResizable';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import type { ChapterStatus, Scene } from '@/types';
import styles from './Inspector.module.css';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'draft', label: 'Draft' },
  { value: 'revised', label: 'Revised' },
  { value: 'final', label: 'Final' }
];

interface InspectorProps {
  open: boolean;
  onClose: () => void;
}

export function Inspector({ open, onClose }: InspectorProps) {
  const { state, activeChapter, updateChapterImmediate, addScene, updateScene, deleteScene } = useApp();
  const [activeTab, setActiveTab] = useState<'details' | 'scenes' | 'notes'>('details');

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

  const wordGoalProgress = useMemo(() => {
    if (!activeChapter?.wordGoal || activeChapter.wordGoal <= 0) return 0;
    return Math.min(100, Math.round((chapterWords / activeChapter.wordGoal) * 100));
  }, [chapterWords, activeChapter?.wordGoal]);

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
      ]
    : [
        { key: 'details' as const, label: 'Chapter', icon: 'description' },
        { key: 'scenes' as const, label: 'Scenes', icon: 'stacks' },
        { key: 'notes' as const, label: 'Notes', icon: 'sticky_note_2' },
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
          <IconButton icon="chevron_right" label="Collapse inspector" variant="ghost" onClick={onClose} className={styles.closeBtn} />
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

                  {/* Tags */}
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Tags</label>
                    <Input
                      value={(activeChapter.tags || []).join(', ')}
                      onChange={e => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                      placeholder={isScreenplay ? 'setpiece, flashback' : 'action, romance, cliffhanger'}
                    />
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
                        <IconButton
                          icon="delete"
                          label="Delete scene"
                          variant="ghost"
                          onClick={() => activeChapter && deleteScene(activeChapter.id, scene.id)}
                        />
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
                  <Button variant="ghost" onClick={() => activeChapter && addScene(activeChapter.id)} className={styles.addBtn}>
                    <span className="material-symbols-rounded">add</span>
                    Add Scene
                  </Button>
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
            </>
          )}
        </div>
      </aside>
    </>
  );
}
