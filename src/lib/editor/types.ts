/**
 * EditorAdapter – abstraction between the app and the concrete editor engine.
 * All components interact with the editor exclusively through this interface.
 */

export interface EditorSelection {
  from: number;
  to: number;
  empty: boolean;
}

export interface CommentAnchor {
  threadId: string;
  from: number;
  to: number;
  state: 'open' | 'resolved';
}

export interface FindReplaceOpts {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export type EditorEventType = 'update' | 'selectionUpdate' | 'focus' | 'blur';

export interface EditorAdapter {
  // ── Content ──────────────────────────────────────────────
  getContent(): string;
  setContent(content: string): void;
  getPlainText(): string;

  // ── Selection ────────────────────────────────────────────
  getSelection(): EditorSelection;
  getSelectedText(): string;
  focus(): void;
  isFocused(): boolean;
  selectAll(): void;
  deleteSelection(): void;

  // ── Formatting (insert / wrap markdown syntax) ──────────
  toggleBold(): void;
  toggleItalic(): void;
  toggleUnderline(): void;
  toggleStrikethrough(): void;
  insertHeading(level: 1 | 2 | 3 | 4): void;
  setParagraph(): void;
  toggleBlockquote(): void;
  toggleBulletList(): void;
  toggleOrderedList(): void;
  insertHorizontalRule(): void;
  insertImage(src: string): void;

  // ── History ──────────────────────────────────────────────
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;

  // ── Active-state queries ─────────────────────────────────
  isActive(name: string, attrs?: Record<string, unknown>): boolean;

  // ── Events ───────────────────────────────────────────────
  on(event: EditorEventType, cb: () => void): void;
  off(event: EditorEventType, cb: () => void): void;

  // ── Find / Replace ───────────────────────────────────────
  findMatches(term: string, opts: FindReplaceOpts): Array<{ from: number; to: number }>;
  highlightMatches(term: string, opts: FindReplaceOpts, currentIndex: number): void;
  clearHighlights(): void;
  replaceRange(from: number, to: number, replacement: string): void;
  replaceAll(term: string, replacement: string, opts: FindReplaceOpts): number;
  scrollToPosition(pos: number): void;

  // ── Comment anchors ──────────────────────────────────────
  setCommentAnchor(threadId: string, from: number, to: number, state: 'open' | 'resolved'): void;
  getCommentAnchors(): CommentAnchor[];
  scrollToCommentAnchor(threadId: string): boolean;
  setCommentAnchorState(threadId: string, state: 'open' | 'resolved'): void;

  // ── Screenplay (Fountain) ───────────────────────────────
  setScreenplayBlockType(type: string): void;
  getScreenplayBlockType(): string | null;

  // ── Line-height (CSS-only) ──────────────────────────────
  setLineHeight(value: string): void;

  // ── Lifecycle ────────────────────────────────────────────
  destroy(): void;

  // ── Raw view access (escape hatch) ──────────────────────
  readonly dom: HTMLElement | null;
}
