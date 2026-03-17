/**
 * Typewriter mode for CodeMirror 6.
 * Scrolls the cursor to the vertical center of the editor on every cursor movement.
 */
import { ViewPlugin, type ViewUpdate, EditorView } from '@codemirror/view';

export const typewriterExtension = ViewPlugin.fromClass(
  class {
    constructor(_view: EditorView) {}

    update(update: ViewUpdate) {
      if (!update.selectionSet && !update.docChanged) return;

      const view = update.view;
      const head = view.state.selection.main.head;
      const coords = view.coordsAtPos(head);
      if (!coords) return;

      const scroller = view.scrollDOM;
      const rect = scroller.getBoundingClientRect();
      const cursorY = coords.top - rect.top + scroller.scrollTop;
      const targetScrollTop = cursorY - rect.height / 2;

      scroller.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }
);
