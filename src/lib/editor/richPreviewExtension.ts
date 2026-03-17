/**
 * Rich preview decorations for the CodeMirror Markdown editor.
 * Makes headings render large, bold/italic render styled, and dims syntax markers.
 */
import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { type EditorState, RangeSetBuilder } from '@codemirror/state';

const headingDeco = (level: number) =>
  Decoration.line({ class: `cm-md-heading-${level}` });

const boldMark = Decoration.mark({ class: 'cm-md-bold' });
const italicMark = Decoration.mark({ class: 'cm-md-italic' });
const strikeMark = Decoration.mark({ class: 'cm-md-strikethrough' });
const codeMark = Decoration.mark({ class: 'cm-md-code' });
const syntaxMark = Decoration.mark({ class: 'cm-md-syntax' });
const blockquoteLine = Decoration.line({ class: 'cm-md-blockquote' });
const hrLine = Decoration.line({ class: 'cm-md-hr' });
const imageMark = Decoration.mark({ class: 'cm-md-image' });
const linkMark = Decoration.mark({ class: 'cm-md-link' });

function buildDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      // Heading lines
      if (node.name.startsWith('ATXHeading')) {
        const level = parseInt(node.name.replace('ATXHeading', ''), 10) || 1;
        const line = state.doc.lineAt(node.from);
        builder.add(line.from, line.from, headingDeco(Math.min(level, 4)));

        // Dim the # markers
        const text = state.doc.sliceString(node.from, node.to);
        const hashEnd = text.indexOf(' ');
        if (hashEnd > 0) {
          builder.add(node.from, node.from + hashEnd + 1, syntaxMark);
        }
      }

      // Bold: StrongEmphasis
      if (node.name === 'StrongEmphasis') {
        const from = node.from;
        const to = node.to;
        // Dim ** markers (first 2 and last 2 chars)
        builder.add(from, from + 2, syntaxMark);
        if (to - from > 4) {
          builder.add(from + 2, to - 2, boldMark);
        }
        builder.add(to - 2, to, syntaxMark);
      }

      // Italic: Emphasis
      if (node.name === 'Emphasis') {
        const from = node.from;
        const to = node.to;
        builder.add(from, from + 1, syntaxMark);
        if (to - from > 2) {
          builder.add(from + 1, to - 1, italicMark);
        }
        builder.add(to - 1, to, syntaxMark);
      }

      // Strikethrough
      if (node.name === 'Strikethrough') {
        const from = node.from;
        const to = node.to;
        builder.add(from, from + 2, syntaxMark);
        if (to - from > 4) {
          builder.add(from + 2, to - 2, strikeMark);
        }
        builder.add(to - 2, to, syntaxMark);
      }

      // Inline code
      if (node.name === 'InlineCode') {
        builder.add(node.from, node.to, codeMark);
      }

      // Blockquote
      if (node.name === 'Blockquote') {
        // Apply line decoration to each line in the blockquote
        const startLine = state.doc.lineAt(node.from).number;
        const endLine = state.doc.lineAt(node.to).number;
        for (let ln = startLine; ln <= endLine; ln++) {
          const line = state.doc.line(ln);
          builder.add(line.from, line.from, blockquoteLine);
          // Dim the > marker
          const lineText = line.text;
          const markerEnd = lineText.startsWith('> ') ? 2 : lineText.startsWith('>') ? 1 : 0;
          if (markerEnd > 0) {
            builder.add(line.from, line.from + markerEnd, syntaxMark);
          }
        }
      }

      // Horizontal rule
      if (node.name === 'HorizontalRule') {
        const line = state.doc.lineAt(node.from);
        builder.add(line.from, line.from, hrLine);
      }

      // Image
      if (node.name === 'Image') {
        builder.add(node.from, node.to, imageMark);
      }

      // Link
      if (node.name === 'Link') {
        builder.add(node.from, node.to, linkMark);
      }
    },
  });

  return builder.finish();
}

export const richPreviewExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
