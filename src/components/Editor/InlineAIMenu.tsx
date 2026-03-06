/**
 * Floating command palette for inline AI slash commands.
 *
 * Appears when the user types `/` in the editor and allows selecting
 * an AI command to execute on the current selection or context.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { INLINE_AI_COMMANDS, renderInlinePrompt } from '@/lib/ai/inlineCommands';
import type { InlineAICommand } from '@/lib/ai/inlineCommands';
import type { InlineAIState } from '@/lib/inlineAIExtension';
import type { Editor } from '@tiptap/core';
import styles from './InlineAIMenu.module.css';

interface InlineAIMenuProps {
  editor: Editor | null;
  aiState: InlineAIState;
  onDismiss: () => void;
  onExecute: (prompt: string, action: string) => void;
}

export function InlineAIMenu({ editor, aiState, onDismiss, onExecute }: InlineAIMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasSelection = editor ? !editor.state.selection.empty : false;

  const filteredCommands = useMemo(() => {
    const query = aiState.query.toLowerCase();
    return INLINE_AI_COMMANDS
      .filter(cmd => !cmd.requiresSelection || hasSelection)
      .filter(cmd =>
        !query ||
        cmd.label.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      );
  }, [aiState.query, hasSelection]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [aiState.query]);

  const executeCommand = useCallback((cmd: InlineAICommand) => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selection = editor.state.doc.textBetween(from, to, '\n');
    const fullText = editor.state.doc.textContent;
    const contextStart = Math.max(0, from - 500);
    const context = fullText.slice(contextStart, from + (selection.length || 200));

    const prompt = renderInlinePrompt(cmd.promptTemplate, { selection, context });

    // Remove the slash and query text that was typed
    if (aiState.from > 0) {
      const deleteFrom = aiState.from - 1; // include the `/`
      const deleteTo = aiState.from + aiState.query.length;
      editor.chain().focus().deleteRange({ from: deleteFrom, to: deleteTo }).run();
    }

    onExecute(prompt, cmd.id);
    onDismiss();
  }, [editor, aiState.from, aiState.query, onExecute, onDismiss]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!aiState.active) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [aiState.active, filteredCommands, selectedIndex, executeCommand]);

  if (!aiState.active || !aiState.decorationPosition) return null;

  return (
    <div
      ref={menuRef}
      className={styles.inlineAIMenu}
      style={{
        position: 'fixed',
        top: aiState.decorationPosition.top,
        left: aiState.decorationPosition.left,
      }}
    >
      <div className={styles.header}>
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>auto_awesome</span>
        <span>AI Commands</span>
        {aiState.query && <span className={styles.query}>/{aiState.query}</span>}
      </div>
      <div className={styles.commandList}>
        {filteredCommands.length === 0 ? (
          <div className={styles.empty}>No matching commands</div>
        ) : (
          filteredCommands.map((cmd, index) => (
            <button
              key={cmd.id}
              className={`${styles.commandItem} ${index === selectedIndex ? styles.selected : ''}`}
              onClick={() => executeCommand(cmd)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{cmd.icon}</span>
              <div className={styles.commandText}>
                <span className={styles.commandLabel}>{cmd.label}</span>
                <span className={styles.commandDesc}>{cmd.description}</span>
              </div>
            </button>
          ))
        )}
      </div>
      <div className={styles.footer}>
        <kbd>↑↓</kbd> navigate <kbd>↵</kbd> select <kbd>esc</kbd> dismiss
      </div>
    </div>
  );
}
