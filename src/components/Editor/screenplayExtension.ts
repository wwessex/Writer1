import Paragraph from '@tiptap/extension-paragraph';

type ScreenplayBlockType = 'scene-heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';

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

export type { ScreenplayBlockType };
