import { useState } from 'react';
import { Info, NotebookPen, Tags, Sparkles, History } from 'lucide-react';

const TABS = [
  { id: 'info', label: 'Info', icon: Info },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'tags', label: 'Tags', icon: Tags },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'history', label: 'History', icon: History },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface RightInspectorProps {
  collapsed?: boolean;
}

export function RightInspector({ collapsed = false }: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('info');

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
        {activeTab === 'info' && <InfoTabContent />}
        {activeTab === 'notes' && <NotesTabContent />}
        {activeTab === 'tags' && <TagsTabContent />}
        {activeTab === 'ai' && <AiTabContent />}
        {activeTab === 'history' && <HistoryTabContent />}
      </div>
    </aside>
  );
}

function InfoTabContent() {
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
                Draft
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#AAB2BD]">Words</dt>
            <dd className="text-[#ECEFF3]">1,031</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#AAB2BD]">Characters</dt>
            <dd className="text-[#ECEFF3]">6,248</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#AAB2BD]">Reading time</dt>
            <dd className="text-[#ECEFF3]">4 min</dd>
          </div>
        </dl>
      </section>

      {/* Goal Progress */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-3">
        <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Goal Progress</h3>
        <div className="flex items-center justify-between text-xs text-[#AAB2BD] mb-2">
          <span>1,031 / 1,500 words</span>
          <span>69%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-[69%] bg-[#41DDF2]" />
        </div>
      </section>

      {/* Dates */}
      <section className="rounded-xl border border-white/10 bg-white/5 p-3">
        <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Dates</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#AAB2BD]">Created</span>
            <span className="text-[#ECEFF3]">20 Feb 2026</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#AAB2BD]">Modified</span>
            <span className="text-[#ECEFF3]">Today, 21:14</span>
          </div>
        </div>
      </section>
    </>
  );
}

function NotesTabContent() {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Chapter Notes</h3>
      <textarea
        className="w-full min-h-[120px] bg-transparent text-sm text-[#ECEFF3] placeholder:text-[#7D8794] resize-none outline-none"
        placeholder="Add notes about this chapter..."
        defaultValue="Sarah discovers the corridor is a liminal space. Foreshadow the reveal in Ch. 7."
      />
    </section>
  );
}

function TagsTabContent() {
  const tags = ['horror', 'suspense', 'corridor', 'Sarah POV'];
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="h-6 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-[#AAB2BD] inline-flex items-center"
          >
            {tag}
          </span>
        ))}
        <button className="h-6 px-2 rounded-md border border-dashed border-white/10 text-xs text-[#7D8794] hover:bg-white/5 inline-flex items-center">
          + Add
        </button>
      </div>
    </section>
  );
}

function AiTabContent() {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">AI Assistant</h3>
      <p className="text-sm text-[#AAB2BD]">
        Select text in the editor and ask AI for suggestions, rewrites, or continuations.
      </p>
      <button className="mt-3 w-full h-9 rounded-lg border border-[#41DDF2]/20 bg-[#41DDF2]/10 text-[#BFF6FD] text-sm hover:bg-[#41DDF2]/20 transition-colors">
        Open AI Panel
      </button>
    </section>
  );
}

function HistoryTabContent() {
  const snapshots = [
    { label: 'Auto-save', time: '2 mins ago', words: '1,031' },
    { label: 'Manual save', time: '28 mins ago', words: '987' },
    { label: 'Auto-save', time: '1 hour ago', words: '842' },
    { label: 'Created', time: '20 Feb 2026', words: '0' },
  ];
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <h3 className="text-xs font-semibold text-[#ECEFF3] mb-2">Snapshots</h3>
      <div className="space-y-2">
        {snapshots.map((snap, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-b-0"
          >
            <div>
              <div className="text-[#ECEFF3]">{snap.label}</div>
              <div className="text-[11px] text-[#7D8794]">{snap.time}</div>
            </div>
            <span className="text-xs text-[#7D8794]">{snap.words}w</span>
          </div>
        ))}
      </div>
    </section>
  );
}
