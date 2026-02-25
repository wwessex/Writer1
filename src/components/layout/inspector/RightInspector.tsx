import { useState, useMemo, useCallback, useEffect } from 'react';
import { Info, NotebookPen, Tags, Sparkles, History, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { countWords, countCharacters, editorToPlainText } from '@/lib/utils';
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
  onOpenAiPanel?: () => void;
}

export function RightInspector({ collapsed = false, onOpenAiPanel }: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const { activeChapter } = useApp();

  if (collapsed) {
    return null;
  }

  return (
    <aside className="w-[320px] border-l border-white/10 bg-[#171A1D] min-h-0 flex flex-col transition-all duration-150">
      {/* Tab Header */}
      <div className="h-12 px-3 border-b border-white/10 flex items-center gap-1 shrink-0">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'h-8 px-2.5 rounded-lg text-xs transition-colors flex items-center gap-1.5',
                active
                  ? 'bg-[#41DDF2]/12 text-[#BFF6FD] border border-[#41DDF2]/20'
                  : 'text-[#AAB2BD] hover:bg-white/5',
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
          <div className="py-8 text-center text-sm text-[#7D8794]">
            Select a chapter to view details
          </div>
        ) : (
          <>
            {activeTab === 'info' && <InfoTabContent chapter={activeChapter} />}
            {activeTab === 'notes' && <NotesTabContent chapter={activeChapter} />}
            {activeTab === 'tags' && <TagsTabContent chapter={activeChapter} />}
            {activeTab === 'ai' && <AiTabContent onOpenAiPanel={onOpenAiPanel} />}
            {activeTab === 'history' && <HistoryTabContent chapter={activeChapter} />}
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
  const readingTime = Math.max(1, Math.ceil(wordCount / 250));

  const goalPercent = chapter.wordGoal > 0
    ? Math.min(100, Math.round((wordCount / chapter.wordGoal) * 100))
    : 0;

  return (
    <>
      {/* Document info */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-3">
        <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Document</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#AAB2BD]">Status</dt>
            <dd>
              <span className="h-6 px-2 rounded-md border border-white/10 bg-white/5 text-xs inline-flex items-center">
                {STATUS_LABELS[chapter.status]}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#AAB2BD]">Words</dt>
            <dd className="text-[#ECEFF3]">{wordCount.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#AAB2BD]">Characters</dt>
            <dd className="text-[#ECEFF3]">{charCount.toLocaleString()}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#AAB2BD]">Reading time</dt>
            <dd className="text-[#ECEFF3]">{readingTime} min</dd>
          </div>
          {chapter.pov && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#AAB2BD]">POV</dt>
              <dd className="text-[#ECEFF3]">{chapter.pov}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Goal Progress */}
      {chapter.wordGoal > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-3">
          <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Goal Progress</h3>
          <div className="flex items-center justify-between text-xs text-[#AAB2BD] mb-2">
            <span>{wordCount.toLocaleString()} / {chapter.wordGoal.toLocaleString()} words</span>
            <span>{goalPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${goalPercent >= 100 ? 'bg-[#3FC17A]' : 'bg-[#41DDF2]'}`}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </section>
      )}

      {/* Dates */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-3">
        <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Dates</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#AAB2BD]">Modified</span>
            <span className="text-[#ECEFF3]">{formatDate(chapter.updatedAt)}</span>
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
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Chapter Notes</h3>
      <textarea
        className="w-full min-h-[120px] bg-transparent text-sm text-[#ECEFF3] placeholder:text-[#7D8794] resize-none outline-none"
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
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {chapter.tags.map((tag) => (
          <span
            key={tag}
            className="h-6 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-[#AAB2BD] inline-flex items-center gap-1 group"
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
            className="h-6 px-2 rounded-md border border-[#41DDF2]/40 bg-white/5 text-xs text-[#ECEFF3] outline-none w-24"
            placeholder="Tag name"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleAddTag}
            autoFocus
          />
        ) : (
          <button
            className="h-6 px-2 rounded-md border border-dashed border-white/10 text-xs text-[#7D8794] hover:bg-white/5 inline-flex items-center"
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
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">AI Assistant</h3>
      <p className="text-sm text-[#AAB2BD]">
        Select text in the editor and ask AI for suggestions, rewrites, or continuations.
      </p>
      <button
        className="mt-3 w-full h-9 rounded-lg border border-[#41DDF2]/20 bg-[#41DDF2]/10 text-[#BFF6FD] text-sm hover:bg-[#41DDF2]/20 transition-colors"
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
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Snapshots</h3>
      {snapshots.length === 0 ? (
        <p className="text-sm text-[#7D8794]">No snapshots yet</p>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-b-0"
            >
              <div>
                <div className="text-[#ECEFF3]">{snap.label || 'Auto-save'}</div>
                <div className="text-[11px] text-[#7D8794]">{formatDate(snap.createdAt)}</div>
              </div>
              <span className="text-xs text-[#7D8794]">
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
