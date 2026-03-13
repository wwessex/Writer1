import { Input, Textarea, Button } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import type { Scene } from '@/types';
import { STATUS_OPTIONS, SCREENPLAY_INT_EXT_OPTIONS, SCREENPLAY_TIME_OPTIONS } from '@/lib/constants';
import styles from './ScenePlanner.module.css';

interface SceneCardProps {
  scene: Scene;
  index: number;
  isScreenplay: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
  isJustMoved: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onUpdate: (sceneId: string, updates: Partial<Scene>) => void;
  onDelete: (sceneId: string) => void;
  onExpand: (sceneId: string) => void;
}

export function SceneCard({
  scene,
  index,
  isScreenplay,
  isExpanded,
  onToggle,
  isDragging,
  isDropTarget,
  isJustMoved,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onUpdate,
  onDelete,
  onExpand,
}: SceneCardProps) {
  return (
    <div
      className={[
        styles.sceneCard,
        isDragging && styles['sceneCard--dragging'],
        isDropTarget && styles['sceneCard--dropTarget'],
        isJustMoved && styles['sceneCard--justMoved']
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={e => onDragStart(e, scene.id)}
      onDragOver={e => onDragOver(e, scene.id)}
      onDragEnd={onDragEnd}
      onDrop={e => onDrop(e, scene.id)}
    >
      <div className={styles.sceneCard__header} onClick={onToggle}>
        <Tooltip content="Drag to reorder" position="left">
          <span className={styles.sceneCard__drag}>
            <span className="material-symbols-rounded">drag_indicator</span>
          </span>
        </Tooltip>
        <span className={styles.sceneCard__number}>{index + 1}</span>
        <span className={styles.sceneCard__title}>{scene.title || 'Untitled Scene'}</span>
        <span className={`${styles.sceneCard__status} ${styles[`sceneCard__status--${scene.status}`]}`}>
          {scene.status}
        </span>
        <Tooltip content={isExpanded ? 'Collapse scene details' : 'Expand scene details'} position="left">
          <span className="material-symbols-rounded">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </Tooltip>
      </div>

      {isExpanded && (
        <div className={styles.sceneCard__body}>
          <div className={styles.sceneCard__field}>
            <label>Title</label>
            <Input
              value={scene.title}
              onChange={e => onUpdate(scene.id, { title: e.target.value })}
              placeholder="Scene title"
            />
          </div>
          <div className={styles.sceneCard__field}>
            <label>Summary</label>
            <Textarea
              value={scene.summary}
              onChange={e => onUpdate(scene.id, { summary: e.target.value })}
              placeholder="What happens in this scene..."
              rows={4}
            />
          </div>
          <div className={styles.sceneCard__fieldRow}>
            <div className={styles.sceneCard__field}>
              <label>Status</label>
              <Select
                options={STATUS_OPTIONS}
                value={scene.status}
                onChange={e => onUpdate(scene.id, { status: e.target.value as Scene['status'] })}
              />
            </div>
            <div className={styles.sceneCard__field}>
              <label>Production Tag</label>
              <Input
                value={(scene.productionTags || []).join(', ')}
                onChange={e => onUpdate(scene.id, { productionTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                placeholder="vfx, stunt"
              />
            </div>
          </div>

          {isScreenplay && (
            <>
              <div className={styles.sceneCard__fieldRow}>
                <div className={styles.sceneCard__field}>
                  <label>Slug Line</label>
                  <Input
                    value={scene.slugLine || ''}
                    onChange={e => onUpdate(scene.id, { slugLine: e.target.value })}
                    placeholder="INT. OFFICE - DAY"
                  />
                </div>
                <div className={styles.sceneCard__field}>
                  <label>Location</label>
                  <Input
                    value={scene.location || ''}
                    onChange={e => onUpdate(scene.id, { location: e.target.value })}
                    placeholder="Office"
                  />
                </div>
              </div>
              <div className={styles.sceneCard__fieldRow}>
                <div className={styles.sceneCard__field}>
                  <label>INT/EXT</label>
                  <Select
                    options={SCREENPLAY_INT_EXT_OPTIONS}
                    value={scene.interiorExterior || 'INT'}
                    onChange={e => onUpdate(scene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                  />
                </div>
                <div className={styles.sceneCard__field}>
                  <label>Time</label>
                  <Select
                    options={SCREENPLAY_TIME_OPTIONS}
                    value={scene.timeOfDay || 'DAY'}
                    onChange={e => onUpdate(scene.id, { timeOfDay: e.target.value as Scene['timeOfDay'] })}
                  />
                </div>
              </div>
              <div className={styles.sceneCard__field}>
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

          <div className={styles.sceneCard__actions}>
            <Tooltip content="Edit scene in expanded view" position="top">
              <Button variant="ghost" size="small" onClick={() => onExpand(scene.id)}>
                <span className="material-symbols-rounded">open_in_full</span>
                Expand
              </Button>
            </Tooltip>
            <Button variant="danger" size="small" onClick={() => onDelete(scene.id)}>
              <span className="material-symbols-rounded">delete</span>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
