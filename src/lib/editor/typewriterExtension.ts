/**
 * Typewriter mode for CodeMirror 6.
 * Scrolls the cursor to the vertical center of the editor on every cursor movement.
 */
import { ViewPlugin, type ViewUpdate, EditorView } from '@codemirror/view';

export const typewriterExtension = ViewPlugin.fromClass(
  class {
    private pendingHead: number | null = null;

    constructor(_view: EditorView) {}

    update(update: ViewUpdate) {
      if (!update.selectionSet && !update.docChanged) return;

      const view = update.view;
      this.pendingHead = view.state.selection.main.head;

      view.requestMeasure({
        read: measuredView => {
          if (this.pendingHead === null) return null;
          const coords = measuredView.coordsAtPos(this.pendingHead);
          if (!coords) return null;

          const scroller = measuredView.scrollDOM;
          const rect = scroller.getBoundingClientRect();
          const cursorY = coords.top - rect.top + scroller.scrollTop;
          const targetScrollTop = Math.max(0, cursorY - rect.height / 2);

          return { targetScrollTop };
        },
        write: (measurement, measuredView) => {
          if (!measurement) return;
          measuredView.scrollDOM.scrollTo({
            top: measurement.targetScrollTop,
            behavior: 'smooth',
          });
          this.pendingHead = null;
        },
      });
    }
  }
);
