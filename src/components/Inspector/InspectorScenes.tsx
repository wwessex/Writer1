import { Input, Textarea, Button, IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import type { Chapter, ChapterStatus, Scene } from '@/types';
import { STATUS_OPTIONS, SCREENPLAY_INT_EXT_OPTIONS, SCREENPLAY_TIME_OPTIONS } from '@/lib/constants';
import styles from './Inspector.module.css';

interface InspectorScenesProps {
  activeChapter: Chapter;
  isScreenplay: boolean;
  handleSceneChange: (sceneId: string, updates: Partial<Scene>) => void;
  deleteScene: (chapterId: string, sceneId: string) => void;
  addScene: (chapterId: string) => void;
}

export function InspectorScenes({
  activeChapter,
  isScreenplay,
  handleSceneChange,
  deleteScene,
  addScene,
}: InspectorScenesProps) {
  return (
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
                onClick={() => deleteScene(activeChapter.id, scene.id)}
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
                    options={SCREENPLAY_INT_EXT_OPTIONS}
                    value={scene.interiorExterior || 'INT'}
                    onChange={e => handleSceneChange(scene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Time</label>
                  <Select
                    options={SCREENPLAY_TIME_OPTIONS}
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
        <Button variant="ghost" onClick={() => addScene(activeChapter.id)} className={styles.addBtn}>
          <span className="material-symbols-rounded">add</span>
          Add Scene
        </Button>
      </Tooltip>
    </div>
  );
}
