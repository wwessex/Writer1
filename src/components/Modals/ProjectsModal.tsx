import { useState, useEffect, useCallback } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { getAllNovels, deleteNovel } from '@/lib/storage';
import { editorToPlainText, countWords } from '@/lib/utils';
import type { Novel, ProjectType } from '@/types';
import { getWorkspaceStore, isProjectLockedElsewhere, togglePinnedProject, trackProjectOpen } from '@/context/services/workspaceService';
import styles from './Modals.module.css';

interface ProjectsModalProps {
  open: boolean;
  onClose: () => void;
}

const isDesktop = () => typeof window !== 'undefined' && '__TAURI__' in window;

export function ProjectsModal({ open, onClose }: ProjectsModalProps) {
  const { state, loadNovelById, createNewNovel, loadNovel } = useApp();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ProjectType>('book');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState(() => getWorkspaceStore());

  const refreshNovels = useCallback(async () => {
    const all = await getAllNovels();
    setNovels(all);
  }, []);

  useEffect(() => {
    if (open) {
      refreshNovels();
      setCreating(false);
      setNewTitle('');
      setNewType('book');
      setConfirmDeleteId(null);
      setWorkspace(getWorkspaceStore());
    }
  }, [open, refreshNovels]);


  const handleSwitchProject = async (id: string) => {
    if (id === state.novelId) return;
    setLoading(true);
    trackProjectOpen(id);
    await loadNovelById(id);
    setLoading(false);
    onClose();
  };

  const handleOpenInNewWindow = async (id: string) => {
    const runtime = (window as Window & { __TAURI__?: { invoke: (command: string, payload?: Record<string, unknown>) => Promise<void> } }).__TAURI__;
    if (!runtime) return;
    await runtime.invoke('open_project_window', { novelId: id });
  };

  const handleCreateProject = async () => {
    if (!newTitle.trim()) return;
    setLoading(true);
    await createNewNovel(newTitle.trim(), newType);
    setLoading(false);
    onClose();
  };

  const handleDeleteProject = async (id: string) => {
    if (novels.length <= 1) return;
    setLoading(true);
    await deleteNovel(id);
    if (id === state.novelId) {
      await loadNovel();
    }
    await refreshNovels();
    setConfirmDeleteId(null);
    setLoading(false);
  };

  const totalWords = state.chapters.reduce((sum, ch) => {
    const text = editorToPlainText(ch.content);
    return sum + countWords(text);
  }, 0);

  return (
    <Dialog open={open} onClose={onClose} title="Projects" size="medium">
      <div className={styles.projectsLayout}>
        <div className={styles.projectsCurrent}>
          <div className={styles.projectsCurrentInfo}>
            <span className={`material-symbols-rounded ${styles.projectsCurrentIcon}`}>
              {state.projectType === 'screenplay' ? 'movie' : 'menu_book'}
            </span>
            <div>
              <p className={styles.projectsCurrentTitle}>{state.novelTitle}</p>
              <p className={styles.projectsCurrentMeta}>
                {state.projectType === 'screenplay' ? 'Screenplay' : 'Book'} &middot; {state.chapters.length} {state.projectType === 'screenplay' ? 'scene' : 'chapter'}{state.chapters.length !== 1 ? 's' : ''} &middot; {totalWords.toLocaleString()} words
              </p>
            </div>
          </div>
        </div>

        <div className={styles.projectsList}>
          <h4 className={styles.projectsListHeading}>All Projects</h4>
          {novels.map(novel => {
            const isActive = novel.id === state.novelId;
            const isPinned = workspace.pinnedProjectIds.includes(novel.id);
            const isRecent = workspace.recentProjectIds.includes(novel.id);
            const locked = isProjectLockedElsewhere(novel.id);
            return (
              <div
                key={novel.id}
                className={`${styles.projectItem} ${isActive ? styles['projectItem--active'] : ''}`}
              >
                <button
                  className={styles.projectItem__main}
                  onClick={() => handleSwitchProject(novel.id)}
                  disabled={loading}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: '1.25rem', color: 'var(--accent)' }}>
                    {novel.projectType === 'screenplay' ? 'movie' : 'menu_book'}
                  </span>
                  <div className={styles.projectItem__info}>
                    <span className={styles.projectItem__title}>{novel.title}</span>
                    <span className={styles.projectItem__meta}>
                      {novel.projectType === 'screenplay' ? 'Screenplay' : 'Book'}
                      {isActive ? ' • Active' : ''}
                      {isPinned ? ' • Pinned' : ''}
                      {isRecent ? ' • Recent' : ''}
                      {locked ? ' • Read-only (open in another window)' : ''}
                    </span>
                  </div>
                </button>
                <button className={styles.projectItem__deleteBtn} onClick={() => { togglePinnedProject(novel.id); setWorkspace(getWorkspaceStore()); }}>
                  <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>{isPinned ? 'star' : 'star_outline'}</span>
                </button>
                {isDesktop() && (
                  <button className={styles.projectItem__deleteBtn} onClick={() => handleOpenInNewWindow(novel.id)} title="Open in new window">
                    <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>open_in_new</span>
                  </button>
                )}
                {confirmDeleteId === novel.id ? (
                  <div className={styles.projectItem__confirmDelete}>
                    <Button variant="danger" size="small" onClick={() => handleDeleteProject(novel.id)} disabled={loading || novels.length <= 1}>Confirm</Button>
                    <Button variant="ghost" size="small" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <button className={styles.projectItem__deleteBtn} onClick={() => setConfirmDeleteId(novel.id)} disabled={novels.length <= 1}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.125rem' }}>delete</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!creating && (
          <Button variant="default" onClick={() => setCreating(true)}>
            <span className="material-symbols-rounded">add</span>
            New Project
          </Button>
        )}
      </div>

      {creating && (
        <div className={styles.projectsCreate}>
          <h4 className={styles.projectsListHeading}>New Project</h4>
          <div className={styles.projectsCreateFields}>
            <input type="text" className={styles.projectsCreateInput} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Project title..." autoFocus />
            <div className={styles.projectsCreateTypeRow}>
              <label className={styles.projectsTypeOption}><input type="radio" name="projectType" value="book" checked={newType === 'book'} onChange={() => setNewType('book')} /><span>Book</span></label>
              <label className={styles.projectsTypeOption}><input type="radio" name="projectType" value="screenplay" checked={newType === 'screenplay'} onChange={() => setNewType('screenplay')} /><span>Screenplay</span></label>
            </div>
          </div>
          <div className={styles.projectsCreateActions}>
            <Button variant="primary" onClick={handleCreateProject} disabled={!newTitle.trim() || loading}>Create Project</Button>
            <Button variant="ghost" onClick={() => { setCreating(false); setNewTitle(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {loading && <p className={styles.exportStatus}>Loading...</p>}
    </Dialog>
  );
}
