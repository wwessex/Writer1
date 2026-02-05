import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Textarea, Button, IconButton } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import type { ChapterStatus } from '@/types';
import styles from './OutlinePanel.module.css';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'draft', label: 'Draft' },
  { value: 'revised', label: 'Revised' },
  { value: 'final', label: 'Final' }
];

export function OutlinePanel() {
  const { activeChapter, updateChapterImmediate, addScene, updateScene, deleteScene } = useApp();
  const [expandedSections, setExpandedSections] = useState({
    details: true,
    scenes: false
  });

  if (!activeChapter) {
    return (
      <section className={styles.outline}>
        <p className={styles.outline__empty}>Select a chapter to view outline</p>
      </section>
    );
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFieldChange = (field: string, value: string | number | string[]) => {
    updateChapterImmediate(activeChapter.id, { [field]: value });
  };

  return (
    <section className={styles.outline}>
      {/* Chapter Details */}
      <div className={styles.section}>
        <button
          className={styles.section__header}
          onClick={() => toggleSection('details')}
        >
          <span className="material-symbols-rounded">
            {expandedSections.details ? 'expand_more' : 'chevron_right'}
          </span>
          <span>Chapter Details</span>
        </button>
        {expandedSections.details && (
          <div className={styles.section__content}>
            <div className={styles.field}>
              <label className={styles.field__label}>Summary</label>
              <Textarea
                value={activeChapter.summary}
                onChange={e => handleFieldChange('summary', e.target.value)}
                placeholder="Brief chapter summary..."
                rows={3}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.field__label}>POV</label>
                <Input
                  value={activeChapter.pov}
                  onChange={e => handleFieldChange('pov', e.target.value)}
                  placeholder="Point of view"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.field__label}>Status</label>
                <Select
                  options={STATUS_OPTIONS}
                  value={activeChapter.status}
                  onChange={e => handleFieldChange('status', e.target.value as ChapterStatus)}
                />
              </div>
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.field__label}>Tags</label>
                <Input
                  value={(activeChapter.tags || []).join(', ')}
                  onChange={e => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  placeholder="action, romance"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.field__label}>Word Goal</label>
                <Input
                  type="number"
                  value={activeChapter.wordGoal || ''}
                  onChange={e => handleFieldChange('wordGoal', parseInt(e.target.value) || 0)}
                  placeholder="2000"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scenes */}
      <div className={styles.section}>
        <button
          className={styles.section__header}
          onClick={() => toggleSection('scenes')}
        >
          <span className="material-symbols-rounded">
            {expandedSections.scenes ? 'expand_more' : 'chevron_right'}
          </span>
          <span>Scenes ({(activeChapter.scenes || []).length})</span>
        </button>
        {expandedSections.scenes && (
          <div className={styles.section__content}>
            {(activeChapter.scenes || []).map(scene => (
              <div key={scene.id} className={styles.sceneCard}>
                <div className={styles.sceneCard__header}>
                  <Input
                    value={scene.title}
                    onChange={e => updateScene(activeChapter.id, scene.id, { title: e.target.value })}
                    className={styles.sceneCard__title}
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
                  onChange={e => updateScene(activeChapter.id, scene.id, { summary: e.target.value })}
                  placeholder="Scene summary..."
                  rows={2}
                />
                <div className={styles.fieldRow}>
                  <Input
                    value={scene.pov}
                    onChange={e => updateScene(activeChapter.id, scene.id, { pov: e.target.value })}
                    placeholder="POV"
                  />
                  <Select
                    options={STATUS_OPTIONS}
                    value={scene.status}
                    onChange={e => updateScene(activeChapter.id, scene.id, { status: e.target.value as ChapterStatus })}
                  />
                </div>
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
