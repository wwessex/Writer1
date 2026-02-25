import { useState, useMemo } from 'react';
import { Dialog } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText, countWords } from '@/lib/utils';
import type { ChapterStatus } from '@/types';
import styles from './Modals.module.css';

interface CorkboardModalProps {
  open: boolean;
  onClose: () => void;
}

type CardSize = 'compact' | 'normal' | 'large';

const STATUS_COLORS: Record<ChapterStatus, string> = {
  planned: '#9ca3af',
  draft: '#3b82f6',
  revised: '#f59e0b',
  final: '#22c55e',
};

export function CorkboardModal({ open, onClose }: CorkboardModalProps) {
  const { state, setActiveChapter } = useApp();
  const [cardSize, setCardSize] = useState<CardSize>('normal');

  const sectionLabel = state.projectType === 'screenplay' ? 'Scenes' : 'Chapters';

  const sortedChapters = useMemo(
    () => [...state.chapters].sort((a, b) => a.order - b.order),
    [state.chapters]
  );

  const cardData = useMemo(
    () =>
      sortedChapters.map((ch) => {
        const plainText = editorToPlainText(ch.content);
        const words = countWords(plainText);
        const summaryPreview =
          ch.summary ||
          (plainText.length > 100 ? plainText.slice(0, 100) + '...' : plainText) ||
          '';
        return { ...ch, words, summaryPreview };
      }),
    [sortedChapters]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<ChapterStatus, number> = {
      planned: 0,
      draft: 0,
      revised: 0,
      final: 0,
    };
    for (const ch of state.chapters) {
      counts[ch.status]++;
    }
    return counts;
  }, [state.chapters]);

  const handleCardClick = (chapterId: string) => {
    setActiveChapter(chapterId);
    onClose();
  };

  const gridSizeClass =
    cardSize === 'compact'
      ? styles['corkboardGrid--compact']
      : cardSize === 'large'
        ? styles['corkboardGrid--large']
        : styles['corkboardGrid--normal'];

  return (
    <Dialog open={open} onClose={onClose} title="Corkboard" size="large">
      <div className={styles.corkboard}>
        {/* Toolbar */}
        <div className={styles.corkboardToolbar}>
          <div className={styles.corkboardToolbar__stats}>
            <span className={styles.corkboardToolbar__stat}>
              <span className="material-symbols-rounded">auto_stories</span>
              {state.chapters.length} {sectionLabel}
            </span>
            {(['planned', 'draft', 'revised', 'final'] as ChapterStatus[]).map(
              (status) =>
                statusCounts[status] > 0 && (
                  <span key={status} className={styles.corkboardToolbar__stat}>
                    <span
                      className={styles.corkboardToolbar__statusDot}
                      style={{ background: STATUS_COLORS[status] }}
                    />
                    {statusCounts[status]} {status}
                  </span>
                )
            )}
          </div>
          <div className={styles.corkboardToolbar__controls}>
            {(['compact', 'normal', 'large'] as CardSize[]).map((size) => (
              <button
                key={size}
                className={`${styles.corkboardSizeBtn} ${cardSize === size ? styles['corkboardSizeBtn--active'] : ''}`}
                onClick={() => setCardSize(size)}
                type="button"
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {cardData.length === 0 ? (
          <div className={styles.corkboardEmpty}>
            <span className="material-symbols-rounded">view_module</span>
            <p>No chapters yet. Create your first chapter to see it here.</p>
          </div>
        ) : (
          <div className={`${styles.corkboardGrid} ${gridSizeClass}`}>
            {cardData.map((card) => (
              <div
                key={card.id}
                className={`${styles.corkboardCard} ${styles[`corkboardCard--${card.status}`]}`}
                onClick={() => handleCardClick(card.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(card.id);
                  }
                }}
              >
                <div className={styles.corkboardCard__header}>
                  <span className={styles.corkboardCard__order}>{card.order + 1}</span>
                  <span className={styles.corkboardCard__title}>{card.title || 'Untitled'}</span>
                  <span
                    className={`${styles.corkboardCard__status} ${styles[`corkboardCard__status--${card.status}`]}`}
                    title={card.status}
                  />
                </div>
                <div className={styles.corkboardCard__body}>
                  {card.summaryPreview ? (
                    <p className={styles.corkboardCard__summary}>{card.summaryPreview}</p>
                  ) : (
                    <p className={styles.corkboardCard__summary} style={{ fontStyle: 'italic' }}>
                      No content yet
                    </p>
                  )}
                </div>
                <div className={styles.corkboardCard__footer}>
                  <span className={styles.corkboardCard__wordCount}>
                    <span className="material-symbols-rounded">notes</span>
                    {card.words.toLocaleString()} words
                  </span>
                  <span className={styles.corkboardCard__statusLabel}>{card.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
