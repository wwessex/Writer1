import type { Chapter } from '@/types';
import { editorToPlainText, downloadFile } from '@/lib/utils';

/**
 * Export chapters to plain text format
 */
export async function exportToPlainText(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  const parts: string[] = [title, '='.repeat(title.length), ''];

  for (const chapter of chapters) {
    if (includeHeadings) {
      parts.push(chapter.title, '-'.repeat(chapter.title.length), '');
    }

    const text = editorToPlainText(chapter.content);
    if (text) {
      parts.push(text, '');
    }
  }

  const output = parts.join('\n').trim();
  downloadFile(output, `${title}.txt`, 'text/plain;charset=utf-8');
}
