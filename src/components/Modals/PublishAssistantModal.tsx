import { useMemo, useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import styles from './Modals.module.css';

interface PublishAssistantModalProps {
  open: boolean;
  onClose: () => void;
}

interface PublishDraft {
  bookDescription: string;
  shortSynopsis: string;
  longSynopsis: string;
  authorBioShort: string;
  authorBioLong: string;
  keywordSuggestions: string;
  categorySuggestions: string;
  backCoverCopy: string;
  hookLines: string;
}

function buildDraft(title: string, chapterSummaries: string[]): PublishDraft {
  const summarySeed = chapterSummaries.filter(Boolean).slice(0, 6).join(' ').trim();
  const seed = summarySeed || `A compelling story in ${title}`;
  return {
    bookDescription: `${title} is a character-driven story that blends emotional stakes with escalating conflict. ${seed.slice(0, 280)}...`,
    shortSynopsis: `${title} follows a protagonist forced to make impossible choices as tension rises and personal cost deepens.`,
    longSynopsis: `${title} opens with a clear status quo before introducing disruption, opposition, and a sequence of increasingly difficult decisions. The narrative drives toward a climactic confrontation and a transformed ending. ${seed}`,
    authorBioShort: 'Author Name writes emotionally resonant fiction with cinematic pacing and vivid prose.',
    authorBioLong: 'Author Name is a storyteller focused on high-stakes character arcs, immersive worldbuilding, and strong thematic threads. Their work explores identity, loyalty, and consequence through commercial, reader-friendly narratives.',
    keywordSuggestions: 'character-driven fiction, emotional stakes, fast-paced narrative, high tension, compelling protagonist',
    categorySuggestions: 'Fiction / General; Fiction / Literary; Fiction / Action & Adventure',
    backCoverCopy: `${title}: One decision. One secret. One chance to survive what comes next.`,
    hookLines: 'What if the truth that could save you is the same truth that could destroy everything?\nSome stories ask who you are. This one asks what you are willing to lose.',
  };
}

export function PublishAssistantModal({ open, onClose }: PublishAssistantModalProps) {
  const { state } = useApp();
  const chapterSummaries = useMemo(() => state.chapters
    .map(ch => ch.summary || editorToPlainText(ch.content).slice(0, 220))
    .filter(Boolean), [state.chapters]);

  const [draft, setDraft] = useState<PublishDraft>(() => buildDraft(state.novelTitle, chapterSummaries));

  const regenerate = () => setDraft(buildDraft(state.novelTitle, chapterSummaries));

  const field = (label: string, key: keyof PublishDraft, rows = 3) => (
    <label className={styles.exportField}>
      <span>{label}</span>
      <textarea
        rows={rows}
        value={draft[key]}
        onChange={(e) => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Publishing Assistant"
      size="large"
      footer={(
        <div className={styles.exportButtons}>
          <Button variant="ghost" onClick={regenerate}>
            <span className="material-symbols-rounded">refresh</span>
            Regenerate Draft
          </Button>
          <Button variant="primary" onClick={onClose}>
            <span className="material-symbols-rounded">check</span>
            Done
          </Button>
        </div>
      )}
    >
      <div className={styles.exportManualSection}>
        <p className={styles.exportOptionHeading}>Book description & blurb generation</p>
        {field('Book description / blurb', 'bookDescription', 4)}

        <p className={styles.exportOptionHeading}>Synopsis variants</p>
        {field('Short synopsis', 'shortSynopsis', 3)}
        {field('Long synopsis', 'longSynopsis', 5)}

        <p className={styles.exportOptionHeading}>Author bio variants</p>
        {field('Short author bio', 'authorBioShort', 3)}
        {field('Long author bio', 'authorBioLong', 4)}

        <p className={styles.exportOptionHeading}>Keyword & category suggestions</p>
        {field('Keyword suggestions (comma separated)', 'keywordSuggestions', 3)}
        {field('Category suggestions (semicolon/comma separated)', 'categorySuggestions', 3)}

        <p className={styles.exportOptionHeading}>Back-cover copy & hook lines</p>
        {field('Back-cover copy', 'backCoverCopy', 4)}
        {field('Hook lines (one per line)', 'hookLines', 4)}
      </div>
    </Dialog>
  );
}
