/**
 * Writing Sprint modal for timed focused writing sessions.
 *
 * Features:
 * - Configurable sprint duration (5/10/15/25/30/60 min)
 * - Word count tracking (start vs end)
 * - Sprint history with WPM calculation
 * - Optional writing prompt
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/UI';
import styles from './Modals.module.css';

interface WritingSprintModalProps {
  open: boolean;
  onClose: () => void;
}

interface SprintRecord {
  id: string;
  startedAt: number;
  duration: number;
  wordsWritten: number;
  wpm: number;
}

const DURATION_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '25 min', value: 25 },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
];

const SPRINT_PROMPTS = [
  'Write about a moment that changed everything.',
  'Describe a place your character would never want to leave.',
  'Start with dialogue — an argument that reveals a secret.',
  'Write the scene you\'ve been avoiding.',
  'Begin with a sensory detail: a smell, a sound, a texture.',
  'Your character receives unexpected news. What happens next?',
  'Write a flashback that explains a current conflict.',
  'Describe a journey — physical, emotional, or both.',
];

const SPRINTS_STORAGE_KEY = 'draftharbour_sprint_history';

function loadSprintHistory(): SprintRecord[] {
  try {
    const raw = localStorage.getItem(SPRINTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSprintHistory(records: SprintRecord[]): void {
  localStorage.setItem(SPRINTS_STORAGE_KEY, JSON.stringify(records.slice(-50)));
}

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function WritingSprintModal({ open, onClose }: WritingSprintModalProps) {
  const { state } = useApp();
  const { showToast } = useToast();
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [phase, setPhase] = useState<'setup' | 'running' | 'complete' | 'history'>('setup');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [startWordCount, setStartWordCount] = useState(0);
  const [currentWordCount, setCurrentWordCount] = useState(0);
  const [sprintHistory, setSprintHistory] = useState<SprintRecord[]>([]);
  const [prompt, setPrompt] = useState('');
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      setSprintHistory(loadSprintHistory());
    }
  }, [open]);

  const getTotalWords = useCallback(() => {
    const activeChapter = state.chapters.find(c => c.id === state.activeChapterId);
    if (!activeChapter?.content) return 0;
    const text = JSON.stringify(activeChapter.content);
    return getWordCount(text);
  }, [state.chapters, state.activeChapterId]);

  const startSprint = useCallback(() => {
    const words = getTotalWords();
    setStartWordCount(words);
    setCurrentWordCount(words);
    setTimeRemaining(selectedDuration * 60);
    startTimeRef.current = Date.now();
    setPhase('running');

    intervalRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPhase('complete');
          showToast('Sprint complete! Great work!', 'success', 'emoji_events');
          return 0;
        }
        return prev - 1;
      });
      setCurrentWordCount(getTotalWords());
    }, 1000);
  }, [selectedDuration, getTotalWords, showToast]);

  const endSprint = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const finalWords = getTotalWords();
    const wordsWritten = Math.max(0, finalWords - startWordCount);
    const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
    const wpm = elapsedMinutes > 0 ? Math.round(wordsWritten / elapsedMinutes) : 0;

    const record: SprintRecord = {
      id: `sprint-${Date.now()}`,
      startedAt: startTimeRef.current,
      duration: Math.round(elapsedMinutes),
      wordsWritten,
      wpm,
    };

    const updated = [...sprintHistory, record];
    setSprintHistory(updated);
    saveSprintHistory(updated);
    setCurrentWordCount(finalWords);
    setPhase('complete');
  }, [getTotalWords, startWordCount, sprintHistory]);

  const randomPrompt = useCallback(() => {
    setPrompt(SPRINT_PROMPTS[Math.floor(Math.random() * SPRINT_PROMPTS.length)]);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const wordsWritten = Math.max(0, currentWordCount - startWordCount);

  return (
    <Dialog open={open} onClose={onClose} title="Writing Sprint" size="medium">
      <div className={styles.section}>
        {phase === 'setup' && (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              Set a timer and write without stopping. Track your words per minute and build momentum.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Duration</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DURATION_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    variant={selectedDuration === opt.value ? 'primary' : 'ghost'}
                    onClick={() => setSelectedDuration(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {prompt && (
              <div style={{ padding: 12, background: 'var(--hover)', borderRadius: 8, marginBottom: 16, fontStyle: 'italic' }}>
                {prompt}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" onClick={startSprint}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>play_arrow</span>
                Start Sprint
              </Button>
              <Button variant="ghost" onClick={randomPrompt}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>casino</span>
                Random Prompt
              </Button>
              <Button variant="ghost" onClick={() => setPhase('history')}>
                History
              </Button>
            </div>
          </>
        )}

        {phase === 'running' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 64, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>
              {formatTime(timeRemaining)}
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, margin: '16px 0' }}>
              {wordsWritten} words
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Keep writing! Don&apos;t look back.
            </p>
            <Button variant="ghost" onClick={endSprint}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>stop</span>
              End Sprint Early
            </Button>
          </div>
        )}

        {phase === 'complete' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 48, color: 'var(--accent)' }}>emoji_events</span>
            <h3 style={{ margin: '12px 0 8px' }}>Sprint Complete!</h3>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{wordsWritten} words</div>
            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 24px' }}>
              {wordsWritten > 0 && `${Math.round(wordsWritten / (selectedDuration || 1))} words per minute`}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => setPhase('setup')}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>play_arrow</span>
                New Sprint
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {phase === 'history' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>Sprint History</h3>
              <Button variant="ghost" onClick={() => setPhase('setup')}>Back</Button>
            </div>
            {sprintHistory.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No sprints yet. Start your first one!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {[...sprintHistory].reverse().map(record => (
                  <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--hover)', borderRadius: 6 }}>
                    <span>{new Date(record.startedAt).toLocaleDateString()}</span>
                    <span>{record.duration} min</span>
                    <span style={{ fontWeight: 600 }}>{record.wordsWritten} words</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{record.wpm} wpm</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
