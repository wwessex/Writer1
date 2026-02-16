import Paragraph from '@tiptap/extension-paragraph';
import { Mark } from '@tiptap/core';
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
    case 'scene-heading':
      return 'action';
    case 'character':
      return 'dialogue';
    case 'parenthetical':
      return 'dialogue';
    case 'dialogue':
      return 'character';
    case 'transition':
      return 'scene-heading';
    case 'action':
    default:
      return 'action';
  }
}

function maybeUppercase(type: ScreenplayBlockType, text: string): string {
  if (type === 'scene-heading' || type === 'character' || type === 'transition') {
    return text.toUpperCase();
  }
  return text;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    screenplayParagraph: {
      setScreenplayBlock: (blockType: ScreenplayBlockType) => ReturnType;
    };
    commentAnchor: {
      setCommentAnchor: (attrs: { threadId: string; state?: 'open' | 'resolved' }) => ReturnType;
      scrollToCommentAnchor: (threadId: string) => ReturnType;
      setCommentAnchorState: (attrs: { threadId: string; state: 'open' | 'resolved' }) => ReturnType;
    };
  }
}

export const ScreenplayParagraph = Paragraph.extend<{ screenplayMode: boolean }>({
  addOptions() {
    return {
      ...this.parent?.(),
      screenplayMode: false,
    };
  },

  addAttributes() {
    return {
      screenplayType: {
        default: null,
        parseHTML: element => element.getAttribute('data-screenplay-type'),
        renderHTML: attributes => {
          if (!attributes.screenplayType) {
            return {};
          }

          return {
            'data-screenplay-type': attributes.screenplayType,
          };
        },
      },
    };
  },

  addCommands() {
    return {
      setScreenplayBlock:
        blockType =>
        ({ commands, editor }) => {
          if (!this.options.screenplayMode) {
            return false;
          }

          const { from, to } = editor.state.selection;
          const selectedText = editor.state.doc.textBetween(from, to, ' ');
          const transformedSelection = selectedText ? maybeUppercase(blockType, selectedText) : selectedText;

          const changed = commands.updateAttributes(this.name, { screenplayType: blockType });

          if (transformedSelection && transformedSelection !== selectedText) {
            commands.insertContentAt({ from, to }, transformedSelection);
          }

          return changed;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.options.screenplayMode || !this.editor.isActive(this.name)) {
          return false;
        }

        const currentType = (this.editor.getAttributes(this.name).screenplayType as ScreenplayBlockType | null) || 'action';
        const nextType = getNextBlockType(currentType);
        return this.editor.commands.setScreenplayBlock(nextType);
      },
      'Shift-Tab': () => {
        if (!this.options.screenplayMode || !this.editor.isActive(this.name)) {
          return false;
        }

        const currentType = (this.editor.getAttributes(this.name).screenplayType as ScreenplayBlockType | null) || 'action';
        const previousType = getNextBlockType(currentType, true);
        return this.editor.commands.setScreenplayBlock(previousType);
      },
      Enter: () => {
        if (!this.options.screenplayMode || !this.editor.isActive(this.name)) {
          return false;
        }

        const currentType = (this.editor.getAttributes(this.name).screenplayType as ScreenplayBlockType | null) || 'action';
        const nextType = getEnterFlow(currentType);

        return this.editor
          .chain()
          .splitBlock()
          .setScreenplayBlock(nextType)
          .run();
      },
    };
  },
});

export const CommentAnchorMark = Mark.create({
  name: 'commentAnchor',

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-thread-id'),
        renderHTML: attributes => {
          if (!attributes.threadId) return {};
          return { 'data-comment-thread-id': attributes.threadId };
        },
      },
      state: {
        default: 'open',
        parseHTML: element => element.getAttribute('data-comment-thread-state') || 'open',
        renderHTML: attributes => ({ 'data-comment-thread-state': attributes.state || 'open' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-thread-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setCommentAnchor:
        attrs =>
        ({ chain, state }) => {
          if (state.selection.empty) return false;
          return chain().setMark(this.name, { threadId: attrs.threadId, state: attrs.state || 'open' }).run();
        },
      scrollToCommentAnchor:
        threadId =>
        ({ editor }) => {
          let anchor: { from: number; to: number } | null = null;

          editor.state.doc.descendants((node, pos) => {
            if (!node.isText || !node.marks.length || anchor) return true;
            const mark = node.marks.find(m => m.type.name === this.name && m.attrs.threadId === threadId);
            if (mark) {
              anchor = { from: pos, to: pos + node.nodeSize };
              return false;
            }
            return true;
          });

          if (!anchor) return false;
          editor.chain().focus().setTextSelection(anchor).scrollIntoView().run();
          return true;
        },
      setCommentAnchorState:
        attrs =>
        ({ tr, state, dispatch }) => {
          let didUpdate = false;
          state.doc.descendants((node, pos) => {
            if (!node.isText || !node.marks.length) return true;
            const mark = node.marks.find(m => m.type.name === this.name && m.attrs.threadId === attrs.threadId);
            if (!mark) return true;

            didUpdate = true;
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
            tr.addMark(pos, pos + node.nodeSize, mark.type.create({ ...mark.attrs, state: attrs.state }));
            return true;
          });

          if (!didUpdate) return false;
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

export type { ScreenplayBlockType } from '@/types';
