import { useMemo, useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Textarea, Button, IconButton } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { countWords, editorToPlainText } from '@/lib/utils';
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

  const isScreenplay = state.projectType === 'screenplay';

  const chapterWords = useMemo(() => {
    if (!activeChapter) return 0;
    return countWords(editorToPlainText(activeChapter.content));
  }, [activeChapter]);

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
      <aside className={styles.inspector} role="complementary" aria-label="Inspector">
        <div className={styles.header}>
          <div className={styles.tabs}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles['tab--active'] : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="material-symbols-rounded">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <IconButton icon="close" label="Close inspector" variant="ghost" onClick={onClose} />
        </div>

        <div className={styles.body}>
          {!activeChapter ? (
            <div className={styles.empty}>
              <span className="material-symbols-rounded">edit_note</span>
              <p>Select a {isScreenplay ? 'scene' : 'chapter'} to inspect</p>
            </div>
          ) : (
            <>
              {activeTab === 'details' && (
                <div className={styles.section}>
                  {/* Word count card */}
                  <div className={styles.statsCard}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{chapterWords.toLocaleString()}</span>
                      <span className={styles.statLabel}>words</span>
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

              {activeTab === 'scenes' && (
                <div className={styles.section}>
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
                        placeholder="Scene summary..."
                        rows={2}
                      />
                      <div className={styles.fieldRow}>
                        <Select
                          options={STATUS_OPTIONS}
                          value={scene.status}
                          onChange={e => handleSceneChange(scene.id, { status: e.target.value as ChapterStatus })}
                        />
                      </div>
                      {isScreenplay && (
                        <>
                          <div className={styles.fieldRow}>
                            <Select
                              options={[
                                { value: 'INT', label: 'INT' },
                                { value: 'EXT', label: 'EXT' },
                                { value: 'INT/EXT', label: 'INT/EXT' }
                              ]}
                              value={scene.interiorExterior || 'INT'}
                              onChange={e => handleSceneChange(scene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                            />
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
                          <Input
                            value={scene.location || ''}
                            onChange={e => handleSceneChange(scene.id, { location: e.target.value })}
                            placeholder="Location"
                          />
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

              {activeTab === 'notes' && (
                <div className={styles.section}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Synopsis</label>
                    <Textarea
                      value={activeChapter.summary}
                      onChange={e => handleFieldChange('summary', e.target.value)}
                      placeholder={`Brief ${isScreenplay ? 'sequence' : 'chapter'} synopsis...`}
                      rows={5}
                    />
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
