import { Input, Textarea, Button, IconButton } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import type { Scene } from '@/types';
import { STATUS_OPTIONS, SCREENPLAY_INT_EXT_OPTIONS, SCREENPLAY_TIME_OPTIONS } from '@/lib/constants';
import styles from './ScenePlanner.module.css';

interface ScenePopoutEditorProps {
  scene: Scene;
  isScreenplay: boolean;
  onUpdate: (sceneId: string, updates: Partial<Scene>) => void;
  onClose: () => void;
}

export function ScenePopoutEditor({
  scene,
  isScreenplay,
  onUpdate,
  onClose,
}: ScenePopoutEditorProps) {
  return (
    <div className={styles.popoutOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.popoutEditor}>
        <div className={styles.popoutEditor__header}>
          <h3 className={styles.popoutEditor__title}>{scene.title || 'Untitled Scene'}</h3>
          <IconButton icon="close" label="Close" variant="ghost" onClick={onClose} />
        </div>
        <div className={styles.popoutEditor__body}>
          <div>
            <label>Title</label>
            <Input
              value={scene.title}
              onChange={e => onUpdate(scene.id, { title: e.target.value })}
              placeholder="Scene title"
            />
          </div>
          <div>
            <label>Summary</label>
            <Textarea
              value={scene.summary}
              onChange={e => onUpdate(scene.id, { summary: e.target.value })}
              placeholder="Describe what happens in this scene in detail..."
              rows={6}
            />
          </div>
          <div className={styles.popoutEditor__fieldRow}>
            <div>
              <label>Status</label>
              <Select
                options={STATUS_OPTIONS}
                value={scene.status}
                onChange={e => onUpdate(scene.id, { status: e.target.value as Scene['status'] })}
              />
            </div>
            <div>
              <label>Production Tags</label>
              <Input
                value={(scene.productionTags || []).join(', ')}
                onChange={e => onUpdate(scene.id, { productionTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                placeholder="vfx, stunt"
              />
            </div>
          </div>
          {isScreenplay && (
            <>
              <div className={styles.popoutEditor__fieldRow}>
                <div>
                  <label>Slug Line</label>
                  <Input
                    value={scene.slugLine || ''}
                    onChange={e => onUpdate(scene.id, { slugLine: e.target.value })}
                    placeholder="INT. OFFICE - DAY"
                  />
                </div>
                <div>
                  <label>Location</label>
                  <Input
                    value={scene.location || ''}
                    onChange={e => onUpdate(scene.id, { location: e.target.value })}
                    placeholder="Office"
                  />
                </div>
              </div>
              <div className={styles.popoutEditor__fieldRow}>
                <div>
                  <label>INT/EXT</label>
                  <Select
                    options={SCREENPLAY_INT_EXT_OPTIONS}
                    value={scene.interiorExterior || 'INT'}
                    onChange={e => onUpdate(scene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                  />
                </div>
                <div>
                  <label>Time</label>
                  <Select
                    options={SCREENPLAY_TIME_OPTIONS}
                    value={scene.timeOfDay || 'DAY'}
                    onChange={e => onUpdate(scene.id, { timeOfDay: e.target.value as Scene['timeOfDay'] })}
                  />
                </div>
              </div>
              <div>
                <label>Page Estimate</label>
                <Input
                  type="number"
                  value={scene.pageEstimate || ''}
                  onChange={e => onUpdate(scene.id, { pageEstimate: parseInt(e.target.value) || 0 })}
                  placeholder="1"
                />
              </div>
            </>
          )}
        </div>
        <div className={styles.popoutEditor__footer}>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
