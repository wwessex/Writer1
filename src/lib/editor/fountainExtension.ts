/**
 * Fountain/Screenplay extension for CodeMirror 6.
 * Provides syntax highlighting, Tab cycling, and smart Enter behavior.
 */
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type EditorState, RangeSetBuilder } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { ScreenplayBlockType } from '@/types';

const BLOCK_FLOW: ScreenplayBlockType[] = ['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];

function getNextBlockType(currentType: ScreenplayBlockType, reverse = false): ScreenplayBlockType {
  const currentIndex = BLOCK_FLOW.indexOf(currentType);
  if (currentIndex === -1) return 'action';
  if (reverse) {
    return BLOCK_FLOW[(currentIndex - 1 + BLOCK_FLOW.length) % BLOCK_FLOW.length];
  }
  return BLOCK_FLOW[(currentIndex + 1) % BLOCK_FLOW.length];
}

function getEnterFlow(currentType: ScreenplayBlockType): ScreenplayBlockType {
  switch (currentType) {
    case 'scene-heading': return 'action';
    case 'character': return 'dialogue';
    case 'parenthetical': return 'dialogue';
    case 'dialogue': return 'character';
    case 'transition': return 'scene-heading';
    case 'action':
    default: return 'action';
  }
}

function maybeUppercase(type: ScreenplayBlockType, text: string): string {
  if (type === 'scene-heading' || type === 'character' || type === 'transition') {
    return text.toUpperCase();
  }
  return text;
}

/** Detect the Fountain block type for a given line of text. */
export function detectBlockType(line: string, prevLine: string): ScreenplayBlockType {
  const trimmed = line.trim();
  if (!trimmed) return 'action';

  // Scene heading
  if (/^(INT|EXT|EST|I\/E)[.\s/]/i.test(trimmed)) return 'scene-heading';
  if (trimmed.startsWith('.') && trimmed.length > 1 && !trimmed.startsWith('..')) return 'scene-heading';

  // Transition
  if (trimmed.startsWith('>') && !trimmed.startsWith('> ')) return 'transition';
  if (/^[A-Z\s]+TO:$/.test(trimmed)) return 'transition';

  // Parenthetical
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return 'parenthetical';

  // Character: forced with @ or ALL CAPS after blank line
  if (trimmed.startsWith('@')) return 'character';
  if (prevLine.trim() === '' && /^[A-Z][A-Z\s'.\-]{0,40}(\s*\(.*\))?$/.test(trimmed) && trimmed.length > 1) {
    return 'character';
  }

  return 'action';
}

// ── Line decorations based on Fountain detection ──────────

const sceneHeadingDeco = Decoration.line({ class: 'cm-fountain-scene-heading' });
const characterDeco = Decoration.line({ class: 'cm-fountain-character' });
const dialogueDeco = Decoration.line({ class: 'cm-fountain-dialogue' });
const parentheticalDeco = Decoration.line({ class: 'cm-fountain-parenthetical' });
const transitionDeco = Decoration.line({ class: 'cm-fountain-transition' });

function getLineDeco(type: ScreenplayBlockType): Decoration | null {
  switch (type) {
    case 'scene-heading': return sceneHeadingDeco;
    case 'character': return characterDeco;
    case 'dialogue': return dialogueDeco;
    case 'parenthetical': return parentheticalDeco;
    case 'transition': return transitionDeco;
    default: return null;
  }
}

function buildFountainDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  let lastType: ScreenplayBlockType = 'action';

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const prevLineText = i > 1 ? state.doc.line(i - 1).text : '';
    let type = detectBlockType(line.text, prevLineText);

    // After character or parenthetical, non-empty lines are dialogue
    if (type === 'action' && line.text.trim() && (lastType === 'character' || lastType === 'parenthetical')) {
      type = 'dialogue';
    }

    const deco = getLineDeco(type);
    if (deco) {
      builder.add(line.from, line.from, deco);
    }
    lastType = line.text.trim() ? type : 'action';
  }

  return builder.finish();
}

export const fountainDecoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildFountainDecorations(view.state);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildFountainDecorations(update.state);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ── Keymap: Tab cycling and smart Enter ────────────────────

function transformLineToType(view: EditorView, targetType: ScreenplayBlockType): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  let text = line.text.trim();

  // Strip existing Fountain markers
  if (text.startsWith('.') && !text.startsWith('..')) text = text.slice(1);
  else if (text.startsWith('@')) text = text.slice(1);
  else if (text.startsWith('>') && !text.startsWith('> ')) text = text.slice(1);

  text = text.trim();
  text = maybeUppercase(targetType, text);

  // Add Fountain markers for the target type
  let newText: string;
  switch (targetType) {
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

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
    selection: { anchor: line.from + newText.length },
  });
  return true;
}

function getCurrentLineType(state: EditorState): ScreenplayBlockType {
  const line = state.doc.lineAt(state.selection.main.head);
  const prevLine = line.number > 1 ? state.doc.line(line.number - 1).text : '';
  return detectBlockType(line.text, prevLine);
}

export const fountainKeymap = keymap.of([
  {
    key: 'Tab',
    run(view) {
      const currentType = getCurrentLineType(view.state);
      const nextType = getNextBlockType(currentType);
      return transformLineToType(view, nextType);
    },
  },
  {
    key: 'Shift-Tab',
    run(view) {
      const currentType = getCurrentLineType(view.state);
      const prevType = getNextBlockType(currentType, true);
      return transformLineToType(view, prevType);
    },
  },
  {
    key: 'Enter',
    run(view) {
      const currentType = getCurrentLineType(view.state);
      const nextType = getEnterFlow(currentType);
      const { state } = view;
      const cursor = state.selection.main.head;

      // Insert newline, then set the new line's type
      let prefix = '';
      switch (nextType) {
        case 'character':
          prefix = '\n@';
          break;
        case 'scene-heading':
          prefix = '\n.';
          break;
        case 'transition':
          prefix = '\n>';
          break;
        case 'parenthetical':
          prefix = '\n(';
          break;
        default:
          prefix = '\n';
      }

      view.dispatch({
        changes: { from: cursor, insert: prefix },
        selection: { anchor: cursor + prefix.length },
      });
      return true;
    },
  },
]);

export { getEnterFlow, getNextBlockType, maybeUppercase };
