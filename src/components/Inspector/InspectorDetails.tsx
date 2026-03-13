import { Input, Textarea } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import type { Chapter, ChapterStatus } from '@/types';
import type { VoiceSimilarityAlert } from '@/lib/voiceFingerprint';
import type { ContinuityMemorySnapshot } from '@/lib/continuityMemory';
import { STATUS_OPTIONS } from '@/lib/constants';
import styles from './Inspector.module.css';

interface InspectorDetailsProps {
  activeChapter: Chapter;
  isScreenplay: boolean;
  chapterWords: number;
  chapterSentences: number;
  chapterParagraphs: number;
  chapterCharacters: number;
  wordGoalProgress: number;
  continuityMemory: ContinuityMemorySnapshot;
  voiceAlerts: VoiceSimilarityAlert[];
  allProjectTags: string[];
  allProjectParts: string[];
  handleFieldChange: (field: string, value: string | number | string[]) => void;
}

export function InspectorDetails({
  activeChapter,
  isScreenplay,
  chapterWords,
  chapterSentences,
  chapterParagraphs,
  chapterCharacters,
  wordGoalProgress,
  continuityMemory,
  voiceAlerts,
  allProjectTags,
  allProjectParts,
  handleFieldChange,
}: InspectorDetailsProps) {
  return (
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
  );
}
