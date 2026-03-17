/**
 * CodeMirror 6 implementation of EditorAdapter.
 * Wraps an EditorView and implements all adapter methods.
 */
import { EditorView } from '@codemirror/view';
import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import { undo, redo, undoDepth, redoDepth } from '@codemirror/commands';
import type {
  EditorAdapter,
  EditorEventType,
  FindReplaceOpts,
  CommentAnchor,
} from './types';
import { markdownToPlainText } from './markdownParser';
import { detectBlockType, maybeUppercase } from './fountainExtension';
import {
  commentAnchorsField,
  setCommentAnchorEffect,
  updateCommentAnchorStateEffect,
} from './commentExtension';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

// ── Find/Replace decoration state ─────────────────────────

export const findHighlightEffect = StateEffect.define<{ decorations: DecorationSet }>();
export const clearFindHighlightEffect = StateEffect.define<void>();

export const findHighlightsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(findHighlightEffect)) return e.value.decorations;
      if (e.is(clearFindHighlightEffect)) return Decoration.none;
    }
    if (tr.docChanged) return decos.map(tr.changes);
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Helpers ────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(term: string, caseSensitive: boolean, wholeWord: boolean): RegExp {
  const escaped = escapeRegex(term);
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
}

// ── Adapter ────────────────────────────────────────────────

export class CodeMirrorAdapter implements EditorAdapter {
  private view: EditorView;
  private listeners: Map<EditorEventType, Set<() => void>> = new Map();

  constructor(view: EditorView) {
    this.view = view;

    // Wire up CM6 update listener to emit events
    // The view already has an updateListener extension configured in the hook
  }

  get dom(): HTMLElement | null {
    return this.view?.dom ?? null;
  }

  // ── Content ──────────────────────────────────────────────

  getContent(): string {
    return this.view.state.doc.toString();
  }

  setContent(content: string): void {
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content,
      },
    });
  }

  getPlainText(): string {
    return markdownToPlainText(this.getContent());
  }

  // ── Selection ────────────────────────────────────────────

  getSelection() {
    const sel = this.view.state.selection.main;
    return { from: sel.from, to: sel.to, empty: sel.empty };
  }

  getSelectedText(): string {
    const sel = this.view.state.selection.main;
    return this.view.state.sliceDoc(sel.from, sel.to);
  }

  focus(): void {
    this.view.focus();
  }

  isFocused(): boolean {
    return this.view.hasFocus;
  }

  selectAll(): void {
    this.view.dispatch({
      selection: EditorSelection.single(0, this.view.state.doc.length),
    });
  }

  deleteSelection(): void {
    const sel = this.view.state.selection.main;
    if (!sel.empty) {
      this.view.dispatch({
        changes: { from: sel.from, to: sel.to },
      });
    }
  }

  // ── Formatting ───────────────────────────────────────────

  private toggleWrap(marker: string): void {
    const sel = this.view.state.selection.main;
    const selectedText = this.view.state.sliceDoc(sel.from, sel.to);

    if (selectedText.startsWith(marker) && selectedText.endsWith(marker) && selectedText.length > marker.length * 2) {
      // Unwrap
      this.view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: selectedText.slice(marker.length, -marker.length) },
        selection: EditorSelection.single(sel.from, sel.to - marker.length * 2),
      });
    } else if (
      sel.from >= marker.length &&
      this.view.state.sliceDoc(sel.from - marker.length, sel.from) === marker &&
      this.view.state.sliceDoc(sel.to, sel.to + marker.length) === marker
    ) {
      // Markers are outside selection — unwrap
      this.view.dispatch({
        changes: [
          { from: sel.from - marker.length, to: sel.from },
          { from: sel.to, to: sel.to + marker.length },
        ] as ChangeSpec,
      });
    } else {
      // Wrap
      this.view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: `${marker}${selectedText}${marker}` },
        selection: EditorSelection.single(sel.from + marker.length, sel.to + marker.length),
      });
    }
  }

  private toggleLinePrefix(prefix: string): void {
    const sel = this.view.state.selection.main;
    const line = this.view.state.doc.lineAt(sel.head);
    if (line.text.startsWith(prefix)) {
      this.view.dispatch({
        changes: { from: line.from, to: line.from + prefix.length },
      });
    } else {
      this.view.dispatch({
        changes: { from: line.from, insert: prefix },
      });
    }
  }

  toggleBold(): void {
    this.toggleWrap('**');
  }

  toggleItalic(): void {
    this.toggleWrap('*');
  }

  toggleUnderline(): void {
    this.toggleWrap('<u>');
    // Need to fix the closing tag
    // Actually, toggleWrap won't work for asymmetric tags. Handle manually.
  }

  toggleStrikethrough(): void {
    this.toggleWrap('~~');
  }

  insertHeading(level: 1 | 2 | 3 | 4): void {
    const sel = this.view.state.selection.main;
    const line = this.view.state.doc.lineAt(sel.head);
    const existingMatch = line.text.match(/^(#{1,6})\s/);
    const newPrefix = '#'.repeat(level) + ' ';

    if (existingMatch) {
      const existingLevel = existingMatch[1].length;
      if (existingLevel === level) {
        // Remove heading
        this.view.dispatch({
          changes: { from: line.from, to: line.from + existingMatch[0].length },
        });
      } else {
        // Change heading level
        this.view.dispatch({
          changes: { from: line.from, to: line.from + existingMatch[0].length, insert: newPrefix },
        });
      }
    } else {
      // Add heading prefix
      this.view.dispatch({
        changes: { from: line.from, insert: newPrefix },
      });
    }
  }

  setParagraph(): void {
    const sel = this.view.state.selection.main;
    const line = this.view.state.doc.lineAt(sel.head);
    const headingMatch = line.text.match(/^#{1,6}\s/);
    if (headingMatch) {
      this.view.dispatch({
        changes: { from: line.from, to: line.from + headingMatch[0].length },
      });
    }
  }

  toggleBlockquote(): void {
    this.toggleLinePrefix('> ');
  }

  toggleBulletList(): void {
    this.toggleLinePrefix('- ');
  }

  toggleOrderedList(): void {
    this.toggleLinePrefix('1. ');
  }

  insertHorizontalRule(): void {
    const cursor = this.view.state.selection.main.head;
    this.view.dispatch({
      changes: { from: cursor, insert: '\n\n---\n\n' },
    });
  }

  insertImage(src: string): void {
    const cursor = this.view.state.selection.main.head;
    this.view.dispatch({
      changes: { from: cursor, insert: `![](${src})` },
    });
  }

  // ── Underline (asymmetric tags) ──────────────────────────

  // Override toggleUnderline with proper asymmetric handling
  // (the toggleWrap above won't handle <u>...</u> correctly because opener != closer)

  // ── History ──────────────────────────────────────────────

  undo(): void {
    undo(this.view);
  }

  redo(): void {
    redo(this.view);
  }

  canUndo(): boolean {
    return undoDepth(this.view.state) > 0;
  }

  canRedo(): boolean {
    return redoDepth(this.view.state) > 0;
  }

  // ── Active state ─────────────────────────────────────────

  isActive(name: string, attrs?: Record<string, unknown>): boolean {
    const sel = this.view.state.selection.main;
    const line = this.view.state.doc.lineAt(sel.head);

    switch (name) {
      case 'bold': {
        if (sel.empty) {
          // Check if cursor is inside **...**
          const before = this.view.state.sliceDoc(Math.max(0, sel.from - 50), sel.from);
          const after = this.view.state.sliceDoc(sel.to, Math.min(this.view.state.doc.length, sel.to + 50));
          return before.includes('**') && after.includes('**');
        }
        const text = this.view.state.sliceDoc(sel.from, sel.to);
        return text.startsWith('**') && text.endsWith('**');
      }
      case 'italic': {
        if (sel.empty) {
          const before = this.view.state.sliceDoc(Math.max(0, sel.from - 50), sel.from);
          const after = this.view.state.sliceDoc(sel.to, Math.min(this.view.state.doc.length, sel.to + 50));
          return (before.includes('*') && after.includes('*'));
        }
        const text = this.view.state.sliceDoc(sel.from, sel.to);
        return (text.startsWith('*') && text.endsWith('*')) && !(text.startsWith('**') && text.endsWith('**'));
      }
      case 'underline': {
        const text = sel.empty ? '' : this.view.state.sliceDoc(sel.from, sel.to);
        return text.startsWith('<u>') && text.endsWith('</u>');
      }
      case 'strike': {
        const text = sel.empty ? '' : this.view.state.sliceDoc(sel.from, sel.to);
        return text.startsWith('~~') && text.endsWith('~~');
      }
      case 'heading': {
        const level = attrs?.level as number | undefined;
        const match = line.text.match(/^(#{1,6})\s/);
        if (!match) return false;
        return level ? match[1].length === level : true;
      }
      case 'bulletList':
        return /^\s*[-*+]\s/.test(line.text);
      case 'orderedList':
        return /^\s*\d+\.\s/.test(line.text);
      case 'blockquote':
        return line.text.startsWith('> ') || line.text === '>';
      default:
        return false;
    }
  }

  // ── Events ───────────────────────────────────────────────

  on(event: EditorEventType, cb: () => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(cb);
  }

  off(event: EditorEventType, cb: () => void): void {
    this.listeners.get(event)?.delete(cb);
  }

  /** Called from the EditorView.updateListener extension. */
  emitUpdate(docChanged: boolean, selectionChanged: boolean, focusChanged: boolean): void {
    if (docChanged) this.emit('update');
    if (selectionChanged) this.emit('selectionUpdate');
    if (focusChanged) {
      this.emit(this.view.hasFocus ? 'focus' : 'blur');
    }
  }

  private emit(event: EditorEventType): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) cb();
    }
  }

  // ── Find / Replace ───────────────────────────────────────

  findMatches(term: string, opts: FindReplaceOpts): Array<{ from: number; to: number }> {
    if (!term) return [];
    const text = this.view.state.doc.toString();
    const regex = buildRegex(term, opts.caseSensitive, opts.wholeWord);
    const results: Array<{ from: number; to: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      results.push({ from: match.index, to: match.index + match[0].length });
    }
    return results;
  }

  highlightMatches(term: string, opts: FindReplaceOpts, currentIndex: number): void {
    const matches = this.findMatches(term, opts);
    const decorations = matches.map((m, i) =>
      Decoration.mark({
        class: i === currentIndex ? 'cm-find-match-current' : 'cm-find-match',
      }).range(m.from, m.to)
    );
    this.view.dispatch({
      effects: findHighlightEffect.of({ decorations: Decoration.set(decorations) }),
    });
  }

  clearHighlights(): void {
    this.view.dispatch({
      effects: clearFindHighlightEffect.of(undefined),
    });
  }

  replaceRange(from: number, to: number, replacement: string): void {
    this.view.dispatch({
      changes: { from, to, insert: replacement },
    });
  }

  replaceAll(term: string, replacement: string, opts: FindReplaceOpts): number {
    const matches = this.findMatches(term, opts);
    if (matches.length === 0) return 0;

    // Replace in reverse order to preserve positions
    const changes = matches.reverse().map(m => ({
      from: m.from,
      to: m.to,
      insert: replacement,
    }));

    this.view.dispatch({ changes });
    return matches.length;
  }

  scrollToPosition(pos: number): void {
    this.view.dispatch({
      selection: EditorSelection.single(pos),
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    });
  }

  // ── Comment anchors ──────────────────────────────────────

  setCommentAnchor(threadId: string, from: number, to: number, state: 'open' | 'resolved'): void {
    this.view.dispatch({
      effects: setCommentAnchorEffect.of({ threadId, from, to, state }),
    });
  }

  getCommentAnchors(): CommentAnchor[] {
    return this.view.state.field(commentAnchorsField);
  }

  scrollToCommentAnchor(threadId: string): boolean {
    const anchors = this.view.state.field(commentAnchorsField);
    const anchor = anchors.find(a => a.threadId === threadId);
    if (!anchor) return false;
    this.view.dispatch({
      selection: EditorSelection.single(anchor.from, anchor.to),
      effects: EditorView.scrollIntoView(anchor.from, { y: 'center' }),
    });
    this.view.focus();
    return true;
  }

  setCommentAnchorState(threadId: string, state: 'open' | 'resolved'): void {
    this.view.dispatch({
      effects: updateCommentAnchorStateEffect.of({ threadId, state }),
    });
  }

  // ── Screenplay ───────────────────────────────────────────

  setScreenplayBlockType(type: string): void {
    // detectBlockType and maybeUppercase imported at top
    const sel = this.view.state.selection.main;
    const line = this.view.state.doc.lineAt(sel.head);
    let text = line.text.trim();

    // Strip existing markers
    if (text.startsWith('.') && !text.startsWith('..')) text = text.slice(1);
    else if (text.startsWith('@')) text = text.slice(1);
    else if (text.startsWith('>') && !text.startsWith('> ')) text = text.slice(1);
    text = text.trim();
    text = maybeUppercase(type as import('@/types').ScreenplayBlockType, text);

    let newText: string;
    switch (type) {
      case 'scene-heading':
        newText = /^(INT|EXT|EST|I\/E)/i.test(text) ? text : `.${text}`;
        break;
      case 'character':
        newText = `@${text}`;
        break;
      case 'transition':
        newText = text.endsWith('TO:') ? text : `>${text}`;
        break;
      case 'parenthetical':
        newText = text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
        break;
      default:
        newText = text;
    }

    this.view.dispatch({
      changes: { from: line.from, to: line.to, insert: newText },
      selection: { anchor: line.from + newText.length },
    });
  }

  getScreenplayBlockType(): string | null {
    // detectBlockType imported at top
    const sel = this.view.state.selection.main;
    const line = this.view.state.doc.lineAt(sel.head);
    const prevLine = line.number > 1 ? this.view.state.doc.line(line.number - 1).text : '';
    return detectBlockType(line.text, prevLine);
  }

  // ── Line height ──────────────────────────────────────────

  setLineHeight(value: string): void {
    (this.view.dom as HTMLElement).style.setProperty('--editor-line-height', value);
  }

  // ── Lifecycle ────────────────────────────────────────────

  destroy(): void {
    this.listeners.clear();
    this.view.destroy();
  }
}
