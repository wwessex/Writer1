import { Dialog } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText } from '@/lib/utils';
import styles from './Modals.module.css';

interface WordCountModalProps {
  open: boolean;
  onClose: () => void;
}

export function WordCountModal({ open, onClose }: WordCountModalProps) {
  const { state, activeChapter } = useApp();

  const chapterWords = activeChapter
    ? countWords(editorToPlainText(activeChapter.content))
    : 0;

  const totalWords = state.chapters.reduce((sum, ch) => {
    return sum + countWords(editorToPlainText(ch.content));
  }, 0);

  const chapterGoalProgress = activeChapter?.wordGoal
    ? Math.round((chapterWords / activeChapter.wordGoal) * 100)
    : null;

  const novelGoalProgress = state.settings.novelWordGoal
    ? Math.round((totalWords / state.settings.novelWordGoal) * 100)
    : null;

  return (
    <Dialog open={open} onClose={onClose} title="Word Count" size="small">
      <div className={styles.wordCountCards}>
        <div className={styles.wordCountCard}>
          <h4>
            <span className="material-symbols-rounded">article</span>
            Current Chapter
          </h4>
          <div className={styles.wordCountValue}>{chapterWords.toLocaleString()}</div>
          {activeChapter && (
            <div className={styles.wordCountLabel}>{activeChapter.title}</div>
          )}
          {chapterGoalProgress !== null && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressBar__fill}
                style={{ width: `${Math.min(100, chapterGoalProgress)}%` }}
              />
              <span className={styles.progressBar__label}>
                {chapterGoalProgress}% of {activeChapter?.wordGoal?.toLocaleString()} goal
              </span>
            </div>
          )}
        </div>

        <div className={styles.wordCountCard}>
          <h4>
            <span className="material-symbols-rounded">menu_book</span>
            Total Novel
          </h4>
          <div className={styles.wordCountValue}>{totalWords.toLocaleString()}</div>
          <div className={styles.wordCountLabel}>
            {state.chapters.length} chapter{state.chapters.length !== 1 ? 's' : ''}
          </div>
          {novelGoalProgress !== null && (
            <div className={styles.progressBar}>
              <div
                className={styles.progressBar__fill}
                style={{ width: `${Math.min(100, novelGoalProgress)}%` }}
              />
              <span className={styles.progressBar__label}>
                {novelGoalProgress}% of {state.settings.novelWordGoal.toLocaleString()} goal
              </span>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
