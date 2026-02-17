import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Textarea, Button, IconButton } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { countWords, editorToPlainText } from '@/lib/utils';
import type { ChapterStatus, Scene } from '@/types';
import styles from './OutlinePanel.module.css';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'draft', label: 'Draft' },
  { value: 'revised', label: 'Revised' },
  { value: 'final', label: 'Final' }
];

export function OutlinePanel() {
  const { state, activeChapter, setActiveChapter, updateChapterImmediate, addScene, updateScene, deleteScene } = useApp();
  const [expandedSections, setExpandedSections] = useState({
    quickJump: true,
    details: true,
    scenes: false
  });

  const isScreenplay = state.projectType === 'screenplay';
  const sectionLabel = isScreenplay ? 'Scene Details' : 'Chapter Details';

  const productionTags = useMemo(() => {
    const tags = new Set<string>();
    state.chapters.forEach(ch => (ch.scenes || []).forEach(scene => (scene.productionTags || []).forEach(tag => tags.add(tag))));
    return Array.from(tags).sort();
  }, [state.chapters]);

  if (!activeChapter) {
    return (
      <section className={styles.outline}>
        <div className={styles.outline__emptyState}>
          <span className={`material-symbols-rounded ${styles.outline__emptyIcon}`}>description</span>
          <p className={styles.outline__empty}>Select a {isScreenplay ? 'scene group' : 'chapter'} to view its outline</p>
          <p className={styles.outline__emptyHint}>
            {isScreenplay
              ? 'Choose a scene group from the sidebar to add act/sequence details, summaries, and scene breakdowns.'
              : 'Choose a chapter from the sidebar to add summaries, POV, status, tags, and word goals.'}
          </p>
        </div>
      </section>
    );
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFieldChange = (field: string, value: string | number | string[]) => {
    updateChapterImmediate(activeChapter.id, { [field]: value });
  };

  const handleSceneChange = (sceneId: string, updates: Partial<Scene>) => {
    updateScene(activeChapter.id, sceneId, updates);
  };

  return (
    <section className={styles.outline}>
      {/* Quick Jump — compact chapter/scene navigation */}
      <div className={styles.section}>
        <button
          className={styles.section__header}
          onClick={() => toggleSection('quickJump')}
        >
          <span className="material-symbols-rounded">
            {expandedSections.quickJump ? 'expand_more' : 'chevron_right'}
          </span>
          <span>Quick Jump</span>
        </button>
        {expandedSections.quickJump && (
          <div className={styles.section__content}>
            <div className={styles.quickJumpList}>
              {state.chapters.map((ch, idx) => {
                const isActive = ch.id === state.activeChapterId;
                const words = countWords(editorToPlainText(ch.content));
                return (
                  <button
                    key={ch.id}
                    className={`${styles.quickJumpItem} ${isActive ? styles['quickJumpItem--active'] : ''}`}
                    onClick={() => setActiveChapter(ch.id)}
                  >
                    <span className={styles.quickJumpItem__number}>{idx + 1}</span>
                    <span className={styles.quickJumpItem__title}>{ch.title}</span>
                    <span className={`${styles.quickJumpItem__status} ${styles[`quickJumpItem__status--${ch.status}`]}`}>
                      {ch.status === 'planned' ? '' : ch.status.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.quickJumpItem__words}>{words.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <button
          className={styles.section__header}
          onClick={() => toggleSection('details')}
        >
          <span className="material-symbols-rounded">
            {expandedSections.details ? 'expand_more' : 'chevron_right'}
          </span>
          <span>{sectionLabel}</span>
        </button>
        {expandedSections.details && (
          <div className={styles.section__content}>
            <div className={styles.field}>
              <label className={styles.field__label}>Summary</label>
              <Textarea
                value={activeChapter.summary}
                onChange={e => handleFieldChange('summary', e.target.value)}
                placeholder={`Brief ${isScreenplay ? 'sequence' : 'chapter'} summary...`}
                rows={3}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.field__label}>{isScreenplay ? 'Act' : 'POV'}</label>
                <Input
                  type={isScreenplay ? 'number' : 'text'}
                  value={isScreenplay ? (activeChapter.act || '') : activeChapter.pov}
                  onChange={e => handleFieldChange(isScreenplay ? 'act' : 'pov', isScreenplay ? (parseInt(e.target.value) || 1) : e.target.value)}
                  placeholder={isScreenplay ? '1' : 'Point of view'}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.field__label}>{isScreenplay ? 'Sequence' : 'Status'}</label>
                {isScreenplay ? (
                  <Input
                    type="number"
                    value={activeChapter.sequence || ''}
                    onChange={e => handleFieldChange('sequence', parseInt(e.target.value) || 1)}
                    placeholder="1"
                  />
                ) : (
                  <Select
                    options={STATUS_OPTIONS}
                    value={activeChapter.status}
                    onChange={e => handleFieldChange('status', e.target.value as ChapterStatus)}
                  />
                )}
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.field__label}>Tags</label>
                <Input
                  value={(activeChapter.tags || []).join(', ')}
                  onChange={e => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  placeholder={isScreenplay ? 'setpiece, flashback' : 'action, romance'}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.field__label}>{isScreenplay ? 'Page Goal' : 'Word Goal'}</label>
                <Input
                  type="number"
                  value={activeChapter.wordGoal || ''}
                  onChange={e => handleFieldChange('wordGoal', parseInt(e.target.value) || 0)}
                  placeholder={isScreenplay ? '5' : '2000'}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <button
          className={styles.section__header}
          onClick={() => toggleSection('scenes')}
        >
          <span className="material-symbols-rounded">
            {expandedSections.scenes ? 'expand_more' : 'chevron_right'}
          </span>
          <span>{isScreenplay ? 'Act / Sequence / Scene' : 'Scenes'} ({(activeChapter.scenes || []).length})</span>
        </button>
        {expandedSections.scenes && (
          <div className={styles.section__content}>
            {(activeChapter.scenes || []).map(scene => (
              <div key={scene.id} className={styles.sceneCard}>
                <div className={styles.sceneCard__header}>
                  <Input
                    value={scene.title}
                    onChange={e => handleSceneChange(scene.id, { title: e.target.value })}
                    className={styles.sceneCard__title}
                    placeholder={isScreenplay ? 'Scene heading' : 'Scene title'}
                  />
                  <IconButton
                    icon="delete"
                    label="Delete scene"
                    variant="ghost"
                    onClick={() => deleteScene(activeChapter.id, scene.id)}
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
                  <Select
                    options={[
                      { value: 'all', label: 'No production tag' },
                      ...productionTags.map(tag => ({ value: tag, label: tag }))
                    ]}
                    value={(scene.productionTags && scene.productionTags[0]) || 'all'}
                    onChange={e => handleSceneChange(scene.id, { productionTags: e.target.value === 'all' ? [] : [e.target.value] })}
                  />
                </div>
                {isScreenplay && (
                  <>
                    <div className={styles.fieldRow}>
                      <Input
                        value={scene.slugLine || ''}
                        onChange={e => handleSceneChange(scene.id, { slugLine: e.target.value })}
                        placeholder="Slug line"
                      />
                      <Input
                        value={scene.location || ''}
                        onChange={e => handleSceneChange(scene.id, { location: e.target.value })}
                        placeholder="Location"
                      />
                    </div>
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
                      type="number"
                      value={scene.pageEstimate || ''}
                      onChange={e => handleSceneChange(scene.id, { pageEstimate: parseInt(e.target.value) || 0 })}
                      placeholder="Page estimate"
                    />
                  </>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              onClick={() => addScene(activeChapter.id)}
              className={styles.addSceneBtn}
            >
              <span className="material-symbols-rounded">add</span>
              Add Scene
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
