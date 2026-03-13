import type { TimelineParadoxFinding } from '@/types';
import type { TimelineConsistencyResult } from '@/lib/timelineConsistency';
import styles from './Inspector.module.css';

interface InspectorTimelineProps {
  timelineFindings: TimelineParadoxFinding[];
  timelineConsistency: TimelineConsistencyResult;
  setActiveChapter: (id: string) => void;
  setActiveTab: (tab: 'details' | 'scenes' | 'notes' | 'weather' | 'timeline') => void;
}

export function InspectorTimeline({
  timelineFindings,
  timelineConsistency,
  setActiveChapter,
  setActiveTab,
}: InspectorTimelineProps) {
  return (
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
  );
}
