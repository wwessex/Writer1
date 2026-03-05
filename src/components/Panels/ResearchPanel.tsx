/**
 * Research Library side panel for collecting and organizing
 * research notes, URLs, and reference material.
 */

import { useState, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import styles from './ResearchPanel.module.css';

export interface ResearchEntry {
  id: string;
  novelId: string;
  type: 'note' | 'url' | 'image';
  title: string;
  content: string;
  url?: string;
  tags: string[];
  linkedChapterIds: string[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'draftharbour_research';

function loadResearchEntries(novelId: string): ResearchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) as ResearchEntry[] : [];
    return all.filter(e => e.novelId === novelId);
  } catch {
    return [];
  }
}

function saveResearchEntries(entries: ResearchEntry[]): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) as ResearchEntry[] : [];
    const otherNovelEntries = existing.filter(
      e => !entries.some(ne => ne.novelId === e.novelId)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...otherNovelEntries, ...entries]));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

interface ResearchPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ResearchPanel({ open, onClose }: ResearchPanelProps) {
  const { state } = useApp();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<ResearchEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', url: '', type: 'note' as ResearchEntry['type'] });
  const [filterTag, setFilterTag] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (open) {
      setEntries(loadResearchEntries(state.novelId));
    }
  }, [open, state.novelId]);

  const addEntry = useCallback(() => {
    if (!newEntry.title.trim()) {
      showToast('Please enter a title', 'warning');
      return;
    }

    const entry: ResearchEntry = {
      id: `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      novelId: state.novelId,
      type: newEntry.type,
      title: newEntry.title.trim(),
      content: newEntry.content.trim(),
      url: newEntry.url.trim() || undefined,
      tags: [],
      linkedChapterIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [...entries, entry];
    setEntries(updated);
    saveResearchEntries(updated);
    setNewEntry({ title: '', content: '', url: '', type: 'note' });
    setShowForm(false);
    showToast('Research entry added', 'success', 'science');
  }, [newEntry, entries, state.novelId, showToast]);

  const deleteEntry = useCallback((id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    saveResearchEntries(updated);
    showToast('Entry deleted', 'info');
  }, [entries, showToast]);

  const updateEntry = useCallback((id: string, updates: Partial<ResearchEntry>) => {
    const updated = entries.map(e =>
      e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e
    );
    setEntries(updated);
    saveResearchEntries(updated);
    setEditingId(null);
  }, [entries]);

  const allTags = [...new Set(entries.flatMap(e => e.tags))];
  const filteredEntries = filterTag
    ? entries.filter(e => e.tags.includes(filterTag))
    : entries;

  if (!open) return null;

  return (
    <div className={styles.researchPanel}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>science</span>
          Research Library
        </h3>
        <div className={styles.headerActions}>
          <Button variant="ghost" onClick={() => setShowForm(!showForm)}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
            Add
          </Button>
          <button className={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className={styles.tagFilter}>
          <button
            className={`${styles.tagChip} ${!filterTag ? styles.tagChipActive : ''}`}
            onClick={() => setFilterTag('')}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`${styles.tagChip} ${filterTag === tag ? styles.tagChipActive : ''}`}
              onClick={() => setFilterTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className={styles.addForm}>
          <div className={styles.typeSelector}>
            {(['note', 'url', 'image'] as const).map(type => (
              <button
                key={type}
                className={`${styles.typeBtn} ${newEntry.type === type ? styles.typeBtnActive : ''}`}
                onClick={() => setNewEntry(prev => ({ ...prev, type }))}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                  {type === 'note' ? 'description' : type === 'url' ? 'link' : 'image'}
                </span>
                {type}
              </button>
            ))}
          </div>
          <input
            className={styles.input}
            placeholder="Title"
            value={newEntry.title}
            onChange={e => setNewEntry(prev => ({ ...prev, title: e.target.value }))}
          />
          {newEntry.type === 'url' && (
            <input
              className={styles.input}
              placeholder="URL"
              value={newEntry.url}
              onChange={e => setNewEntry(prev => ({ ...prev, url: e.target.value }))}
            />
          )}
          <textarea
            className={styles.textarea}
            placeholder="Notes..."
            rows={3}
            value={newEntry.content}
            onChange={e => setNewEntry(prev => ({ ...prev, content: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={addEntry}>Save</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className={styles.entryList}>
        {filteredEntries.length === 0 ? (
          <div className={styles.empty}>
            <span className="material-symbols-rounded" style={{ fontSize: 32, opacity: 0.3 }}>science</span>
            <p>No research entries yet.</p>
            <p style={{ fontSize: 12 }}>Add notes, URLs, and references for your project.</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div key={entry.id} className={styles.entryCard}>
              <div className={styles.entryHeader}>
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                  {entry.type === 'note' ? 'description' : entry.type === 'url' ? 'link' : 'image'}
                </span>
                {editingId === entry.id ? (
                  <input
                    className={styles.input}
                    value={entry.title}
                    onChange={e => updateEntry(entry.id, { title: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <span className={styles.entryTitle} onClick={() => setEditingId(entry.id)}>
                    {entry.title}
                  </span>
                )}
                <button className={styles.deleteBtn} onClick={() => deleteEntry(entry.id)}>
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
              {entry.url && (
                <a href={entry.url} target="_blank" rel="noopener noreferrer" className={styles.entryUrl}>
                  {entry.url}
                </a>
              )}
              {entry.content && <p className={styles.entryContent}>{entry.content}</p>}
              <div className={styles.entryMeta}>
                {new Date(entry.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
