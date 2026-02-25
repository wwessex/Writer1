import type { ReactNode } from 'react';

interface EditorPaneProps {
  children?: ReactNode;
}

export function EditorPane({ children }: EditorPaneProps) {
  return (
    <main className="flex-1 min-w-0 min-h-0 bg-[#111315] flex flex-col">
      {/* Document Header */}
      <div className="px-6 pt-5 pb-3 border-b border-white/5 shrink-0">
        <input
          defaultValue="Chapter 4 \u2014 The Corridor"
          className="w-full bg-transparent text-2xl font-semibold leading-tight text-[#ECEFF3] placeholder:text-[#7D8794] outline-none"
          placeholder="Untitled document"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#AAB2BD]">
          <span className="h-6 px-2 rounded-md border border-white/10 bg-white/5 inline-flex items-center">
            Draft
          </span>
          <span>Edited 12 mins ago</span>
          <span className="text-white/10">&bull;</span>
          <span>1,031 words</span>
          <span className="text-white/10">&bull;</span>
          <span>4 min read</span>
        </div>
      </div>

      {/* Editor Scroll Region */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 pb-24">
          <div className="max-w-[720px] mx-auto pt-6">
            {/* Contextual toolbar */}
            <div className="mb-4 flex items-center gap-2">
              <button className="h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-[#AAB2BD]">
                Draft preset
              </button>
              <button className="h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-[#AAB2BD]">
                Width
              </button>
              <button className="h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-[#AAB2BD]">
                Line spacing
              </button>
              <button className="h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-[#AAB2BD]">
                Typewriter
              </button>
            </div>

            {/* Editor mount point or placeholder */}
            {children ?? (
              <div className="writer1-editor prose prose-invert max-w-none">
                <p>
                  The corridor stretched endlessly ahead, its fluorescent lights flickering in
                  an arrhythmic pulse that made the shadows dance along the walls. Sarah pressed
                  her back against the cold tiles, her breath coming in shallow gasps that fogged
                  in the suddenly frigid air.
                </p>
                <p>
                  Something had changed. The building that had felt so mundane during the day
                  &mdash; a place of routine and tedium &mdash; now seemed to breathe with a
                  malevolent awareness. The doors on either side of the hallway were closed, their
                  small rectangular windows reflecting nothing but darkness.
                </p>
                <p>
                  She heard it again. That sound. Not quite footsteps, not quite breathing.
                  Something in between that defied categorization and sent ice water through her
                  veins. It was closer now.
                </p>
                <h2>The Discovery</h2>
                <p>
                  The third door on the left was ajar. Just barely &mdash; a sliver of deeper
                  darkness beyond the gap. Sarah knew she should keep moving, should find the
                  exit, should call for help. But the door pulled at her attention like a
                  gravitational force.
                </p>
                <p>
                  She reached for the handle.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
