import { describe, expect, it } from 'vitest';
import type { EditorAdapter, EditorSelection, CommentAnchor, FindReplaceOpts, EditorEventType } from './types';

describe('editor types', () => {
  it('exports EditorAdapter interface type', () => {
    // Type-level test: these would fail at compile time if types don't exist
    const adapter: EditorAdapter | null = null;
    expect(adapter).toBeNull();
  });

  it('exports supporting types', () => {
    const selection: EditorSelection = { from: 0, to: 0, empty: true };
    const anchor: CommentAnchor = { threadId: 't1', from: 0, to: 5, state: 'open' };
    const opts: FindReplaceOpts = { caseSensitive: false, wholeWord: false };
    const event: EditorEventType = 'update';
    expect(selection.empty).toBe(true);
    expect(anchor.threadId).toBe('t1');
    expect(opts.caseSensitive).toBe(false);
    expect(event).toBe('update');
  });
});
