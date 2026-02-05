import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, Button } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { clearAllData } from '@/lib/storage';
import styles from './Windows.module.css';

interface SettingsWindowProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'de-DE', label: 'German' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'pt-BR', label: 'Portuguese (BR)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'pl-PL', label: 'Polish' },
  { value: 'ru-RU', label: 'Russian' }
];

export function SettingsWindow({ open, onClose }: SettingsWindowProps) {
  const { state, updateSettings } = useApp();
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Reset position when reopened
  useEffect(() => {
    if (open && windowRef.current) {
      windowRef.current.style.left = '';
      windowRef.current.style.top = '';
      windowRef.current.style.transform = '';
    }
  }, [open]);

  // Handle drag (desktop only)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest(`.${styles.window__header}`)) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (windowRef.current) {
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        windowRef.current.style.left = `${x}px`;
        windowRef.current.style.top = `${y}px`;
        windowRef.current.style.transform = 'none';
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleResetData = async () => {
    if (confirm('This will delete ALL your data including novels, chapters, and snapshots. This cannot be undone. Continue?')) {
      await clearAllData();
      window.location.reload();
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className={`${styles.backdrop} ${styles['backdrop--visible']}`}
        onClick={onClose}
      />
      <div
        ref={windowRef}
        className={styles.window}
        onMouseDown={handleMouseDown}
      >
        <div className={styles.window__header}>
          <h3>Settings</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className={styles.window__body}>
          {/* Online Sync Section */}
          <section className={styles.section}>
            <h4>
              <span className="material-symbols-rounded">cloud_sync</span>
              Online Sync
            </h4>
            <div className={styles.field}>
              <label>Novel ID</label>
              <Input
                value={state.settings.sync.novelId}
                onChange={e => updateSettings({
                  sync: { ...state.settings.sync, novelId: e.target.value }
                })}
                placeholder="unique-novel-id"
              />
            </div>
            <div className={styles.field}>
              <label>Sync Server URL</label>
              <Input
                value={state.settings.sync.url}
                onChange={e => updateSettings({
                  sync: { ...state.settings.sync, url: e.target.value }
                })}
                placeholder="https://your-server.com/sync"
              />
            </div>
            <div className={styles.field}>
              <label>Authorization Header</label>
              <Input
                type="password"
                value={state.settings.sync.auth}
                onChange={e => updateSettings({
                  sync: { ...state.settings.sync, auth: e.target.value }
                })}
                placeholder="Bearer your-token"
              />
            </div>
          </section>

          {/* Writing Assistance Section */}
          <section className={styles.section}>
            <h4>
              <span className="material-symbols-rounded">spellcheck</span>
              Writing Assistance
            </h4>
            <div className={styles.fieldRow}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={state.settings.assist.languageToolEnabled}
                  onChange={e => updateSettings({
                    assist: { ...state.settings.assist, languageToolEnabled: e.target.checked }
                  })}
                />
                <span>Enable LanguageTool</span>
              </label>
            </div>
            <div className={styles.field}>
              <label>LanguageTool URL</label>
              <Input
                value={state.settings.assist.languageToolUrl}
                onChange={e => updateSettings({
                  assist: { ...state.settings.assist, languageToolUrl: e.target.value }
                })}
                placeholder="https://api.languagetool.org/v2/check"
              />
            </div>
            <div className={styles.field}>
              <label>Language</label>
              <Select
                options={LANGUAGE_OPTIONS}
                value={state.settings.assist.languageToolLanguage}
                onChange={e => updateSettings({
                  assist: { ...state.settings.assist, languageToolLanguage: e.target.value }
                })}
              />
            </div>
          </section>

          {/* App Settings Section */}
          <section className={styles.section}>
            <h4>
              <span className="material-symbols-rounded">settings</span>
              Application
            </h4>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Autosave (ms)</label>
                <Input
                  type="number"
                  value={state.settings.autosaveMs}
                  onChange={e => updateSettings({ autosaveMs: parseInt(e.target.value) || 800 })}
                  min={100}
                  max={5000}
                />
              </div>
              <div className={styles.field}>
                <label>Daily Word Goal</label>
                <Input
                  type="number"
                  value={state.settings.dailyWordGoal || ''}
                  onChange={e => updateSettings({ dailyWordGoal: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className={styles.field}>
              <label>Novel Word Goal</label>
              <Input
                type="number"
                value={state.settings.novelWordGoal || ''}
                onChange={e => updateSettings({ novelWordGoal: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </section>
        </div>

        <div className={styles.window__footer}>
          <Button variant="danger" onClick={handleResetData}>
            <span className="material-symbols-rounded">delete_forever</span>
            Reset All Data
          </Button>
        </div>
      </div>
    </>
  );
}
