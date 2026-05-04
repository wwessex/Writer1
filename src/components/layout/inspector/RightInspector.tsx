import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Info, NotebookPen, Tags, Sparkles, History, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { countWords, countCharacters, editorToPlainText, estimateReadingMinutes } from '@/lib/utils';
import { getSnapshots } from '@/lib/storage';
import type { Chapter, ChapterStatus, Snapshot } from '@/types';

const TABS = [
  { id: 'info', label: 'Info', icon: Info },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'tags', label: 'Tags', icon: Tags },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'history', label: 'History', icon: History },
] as const;

type TabId = (typeof TABS)[number]['id'];

const STATUS_LABELS: Record<ChapterStatus, string> = {
  planned: 'Planned',
  draft: 'Draft',
  revised: 'Revised',
  final: 'Final',
};

interface RightInspectorProps {
  collapsed?: boolean;
  width?: number;
  resizeHandleProps?: { onMouseDown: (e: React.MouseEvent) => void; onTouchStart: (e: React.TouchEvent) => void };
  isResizing?: boolean;
  onOpenAiPanel?: () => void;
}

export function RightInspector({ collapsed = false, width = 320, resizeHandleProps, isResizing, onOpenAiPanel }: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const { activeChapter } = useApp();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + TABS.length) % TABS.length;
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  }, []);

  if (collapsed) {
    return null;
  }

  return (
    <aside
      className="relative border-l border-[var(--border)] bg-[var(--panel)] min-h-0 flex flex-col transition-[width] duration-200 ease-[var(--ease-smooth)]"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      {resizeHandleProps && (
        <div
          className={[
            'resize-handle resize-handle--left',
            isResizing ? 'resize-handle--active' : '',
          ].join(' ')}
          onMouseDown={resizeHandleProps.onMouseDown}
          onTouchStart={resizeHandleProps.onTouchStart}
        />
      )}

      {/* Tab Header */}
      <div className="h-12 px-3 border-b border-[var(--border)] flex items-center gap-1 shrink-0" role="tablist" aria-label="Inspector tabs">
        {TABS.map((tab, index) => {
          const active = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              id={`inspector-tab-${tab.id}`}
              role="tab"
              aria-selected={active}
              aria-controls={`inspector-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              className={[
                'h-8 px-2.5 rounded-lg text-xs transition-colors flex items-center gap-1.5',
                active
                  ? 'bg-[var(--accent-alpha)] text-[var(--accent)] border border-[var(--accent-subtle)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--btn-bg)]',
              ].join(' ')}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {!activeChapter ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">
            Select a chapter to view details
          </div>
        ) : (
          <>
            <div role="tabpanel" id="inspector-panel-info" aria-labelledby="inspector-tab-info" hidden={activeTab !== 'info'}>
              {activeTab === 'info' && <InfoTabContent chapter={activeChapter} />}
            </div>
            <div role="tabpanel" id="inspector-panel-notes" aria-labelledby="inspector-tab-notes" hidden={activeTab !== 'notes'}>
              {activeTab === 'notes' && <NotesTabContent chapter={activeChapter} />}
            </div>
            <div role="tabpanel" id="inspector-panel-tags" aria-labelledby="inspector-tab-tags" hidden={activeTab !== 'tags'}>
              {activeTab === 'tags' && <TagsTabContent chapter={activeChapter} />}
            </div>
            <div role="tabpanel" id="inspector-panel-ai" aria-labelledby="inspector-tab-ai" hidden={activeTab !== 'ai'}>
              {activeTab === 'ai' && <AiTabContent onOpenAiPanel={onOpenAiPanel} />}
            </div>
            <div role="tabpanel" id="inspector-panel-history" aria-labelledby="inspector-tab-history" hidden={activeTab !== 'history'}>
              {activeTab === 'history' && <HistoryTabContent chapter={activeChapter} />}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function InfoTabContent({ chapter }: { chapter: Chapter }) {
  const chapterText = useMemo(() => editorToPlainText(chapter.content), [chapter.content]);
  const wordCount = useMemo(() => countWords(chapterText), [chapterText]);
  const charCount = useMemo(() => countCharacters(chapterText), [chapterText]);
  const readingTime = estimateReadingMinutes(wordCount);

  const goalPercent = chapter.wordGoal > 0
    ? Math.min(100, Math.round((wordCount / chapter.wordGoal) * 100))
    : 0;

  return (
    <>
      {/* Document info */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] p-3">
        <h3 className="text-xs font-semibold text-[var(--text)] mb-2">Document</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--text-secondary)]">Status</dt>
            <dd>
              <span className="h-6 px-2 rounded-md border border-[var(--border)] bg-[var(--btn-bg)] text-xs inline-flex items-center">
                {STATUS_LABELS[chapter.status]}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--text-secondary)]">Words</dt>
            <dd className="text-[var(--text)]">{wordCount.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--text-secondary)]">Characters</dt>
            <dd className="text-[var(--text)]">{charCount.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--text-secondary)]">Reading time</dt>
            <dd className="text-[var(--text)]">{readingTime} min</dd>
          </div>
          {chapter.pov && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-secondary)]">POV</dt>
              <dd className="text-[var(--text)]">{chapter.pov}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Goal Progress */}
      {chapter.wordGoal > 0 && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] p-3">
          <h3 className="text-xs font-semibold text-[var(--text)] mb-2">Goal Progress</h3>
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
            <span>{wordCount.toLocaleString()} / {chapter.wordGoal.toLocaleString()} words</span>
            <span>{goalPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--btn-bg)] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${goalPercent >= 100 ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'}`}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </section>
      )}

      {/* Dates */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] p-3">
        <h3 className="text-xs font-semibold text-[var(--text)] mb-2">Dates</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">Modified</span>
            <span className="text-[var(--text)]">{formatDate(chapter.updatedAt)}</span>
          </div>
        </div>
      </section>
    </>
  );
}

function NotesTabContent({ chapter }: { chapter: Chapter }) {
  const { updateChapter } = useApp();

  const handleSummaryChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateChapter(chapter.id, { summary: e.target.value });
    },
    [chapter.id, updateChapter],
  );

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] p-3">
      <h3 className="text-xs font-semibold text-[var(--text)] mb-2">Chapter Notes</h3>
      <textarea
        className="w-full min-h-[120px] bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] resize-none outline-none"
        placeholder="Add notes about this chapter..."
        value={chapter.summary}
        onChange={handleSummaryChange}
      />
    </section>
  );
}

function TagsTabContent({ chapter }: { chapter: Chapter }) {
  const { updateChapter } = useApp();
  const [newTag, setNewTag] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      updateChapter(chapter.id, {
        tags: chapter.tags.filter((t) => t !== tagToRemove),
      });
    },
    [chapter.id, chapter.tags, updateChapter],
  );

  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim();
    if (trimmed && !chapter.tags.includes(trimmed)) {
      updateChapter(chapter.id, { tags: [...chapter.tags, trimmed] });
    }
    setNewTag('');
    setIsAdding(false);
  }, [chapter.id, chapter.tags, newTag, updateChapter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Escape') {
        setNewTag('');
        setIsAdding(false);
      }
    },
    [handleAddTag],
  );

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] p-3">
      <h3 className="text-xs font-semibold text-[var(--text)] mb-2">Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {chapter.tags.map((tag) => (
          <span
            key={tag}
            className="h-6 px-2 rounded-md border border-[var(--border)] bg-[var(--btn-bg)] text-xs text-[var(--text-secondary)] inline-flex items-center gap-1 group"
          >
            {tag}
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemoveTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {isAdding ? (
          <input
            className="h-6 px-2 rounded-md border border-[var(--accent)]/40 bg-[var(--btn-bg)] text-xs text-[var(--text)] outline-none w-24"
            placeholder="Tag name"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAddTag}
            autoFocus
          />
        ) : (
          <button
            className="h-6 px-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--btn-bg)] inline-flex items-center transition-colors"
            onClick={() => setIsAdding(true)}
          >
            + Add
          </button>
        )}
      </div>
    </section>
  );
}

function AiTabContent({ onOpenAiPanel }: { onOpenAiPanel?: () => void }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] p-3">
      <h3 className="text-xs font-semibold text-[var(--text)] mb-2">AI Assistant</h3>
      <p className="text-sm text-[var(--text-secondary)]">
        Select text in the editor and ask AI for suggestions, rewrites, or continuations.
      </p>
      <button
        className="mt-3 w-full h-9 rounded-lg border border-[var(--accent-subtle)] bg-[var(--accent-alpha)] text-[var(--accent)] text-sm hover:bg-[var(--accent-subtle)] transition-colors"
        onClick={onOpenAiPanel}
      >
        Open AI Panel
      </button>
    </section>
  );
}

function HistoryTabContent({ chapter }: { chapter: Chapter }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    void getSnapshots(chapter.id).then(setSnapshots);
  }, [chapter.id]);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] p-3">
      <h3 className="text-xs font-semibold text-[var(--text)] mb-2">Snapshots</h3>
      {snapshots.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No snapshots yet</p>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--border-subtle)] last:border-b-0"
            >
              <div>
                <div className="text-[var(--text)]">{snap.label || 'Auto-save'}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{formatDate(snap.createdAt)}</div>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                {countWords(editorToPlainText(snap.doc))}w
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Today, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
