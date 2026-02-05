import { useApp } from '@/context/AppContext';
import { Input } from '@/components/UI';
import { Pill, StatusDot } from '@/components/UI/Pill';
import { MenuBar } from '@/components/Menu/MenuBar';
import { Toolbar } from './Toolbar';
import { countWords, editorToPlainText } from '@/lib/utils';
import styles from './Header.module.css';

interface HeaderProps {
  onAction?: (action: string) => void;
}

export function Header({ onAction }: HeaderProps) {
  const { state, updateNovelTitle } = useApp();

  // Calculate word counts
  const totalWords = state.chapters.reduce((sum, ch) => {
    const text = editorToPlainText(ch.content);
    return sum + countWords(text);
  }, 0);

  const activeChapter = state.chapters.find(ch => ch.id === state.activeChapterId);
  const chapterWords = activeChapter
    ? countWords(editorToPlainText(activeChapter.content))
    : 0;

  return (
    <header className={styles.header}>
      <div className={styles.topbar}>
        <div className={styles.topbar__brand}>
          <span className={styles.logo}>NW</span>
          <Input
            variant="title"
            value={state.novelTitle}
            onChange={e => updateNovelTitle(e.target.value)}
            placeholder="Novel Title"
            className={styles.novelTitle}
          />
        </div>
        <div className={styles.topbar__status}>
          <StatusDot online={state.isOnline} />
          <Pill label="Ch" value={chapterWords.toLocaleString()} />
          <Pill label="Total" value={totalWords.toLocaleString()} />
          {state.settings.dailyWordGoal > 0 && (
            <Pill
              label="Goal"
              value={`${Math.min(100, Math.round((totalWords / state.settings.dailyWordGoal) * 100))}%`}
              variant="accent"
            />
          )}
          {state.isSaving && (
            <span className={styles.savingStatus}>Saving...</span>
          )}
        </div>
      </div>
      <MenuBar onAction={onAction} />
      <Toolbar />
    </header>
  );
}
