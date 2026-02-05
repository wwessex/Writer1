import { useEffect, useCallback } from 'react';
import { useCurrentEditor, EditorContent } from '@tiptap/react';
import { useApp } from '@/context/AppContext';
import { Input, IconButton } from '@/components/UI';
import styles from './Editor.module.css';

export function Editor() {
  const { state, activeChapter, updateChapterImmediate, deleteChapter } = useApp();
  const { editor } = useCurrentEditor();

  // Update editor content when chapter changes
  useEffect(() => {
    if (editor && activeChapter) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(activeChapter.content || { type: 'doc', content: [] });

      if (currentContent !== newContent) {
        editor.commands.setContent(activeChapter.content || '');
      }
    }
  }, [editor, activeChapter?.id]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeChapter) {
      updateChapterImmediate(activeChapter.id, { title: e.target.value });
    }
  }, [activeChapter, updateChapterImmediate]);

  const handleDelete = useCallback(() => {
    if (activeChapter && confirm('Delete this chapter? This cannot be undone.')) {
      deleteChapter(activeChapter.id);
    }
  }, [activeChapter, deleteChapter]);

  if (!activeChapter) {
    return (
      <div className={styles.editorPane}>
        <div className={styles.editorEmpty}>
          <span className="material-symbols-rounded">edit_note</span>
          <p>Select a chapter to start writing</p>
        </div>
      </div>
    );
  }

  const editorClass = `${styles.editorPane} ${state.settings.pageView ? styles['editorPane--pageView'] : ''}`;

  return (
    <div className={editorClass}>
      <div className={styles.editorHeader}>
        <Input
          variant="title"
          value={activeChapter.title}
          onChange={handleTitleChange}
          placeholder="Chapter Title"
          className={styles.chapterTitle}
        />
        <IconButton
          icon="delete"
          label="Delete chapter"
          variant="ghost"
          onClick={handleDelete}
        />
      </div>
      <div className={styles.editorContent}>
        <EditorContent editor={editor} className={styles.editorWrapper} />
      </div>
    </div>
  );
}
