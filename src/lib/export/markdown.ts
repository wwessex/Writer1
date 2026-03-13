import type { JSONContent } from '@tiptap/core';
import type { Chapter } from '@/types';
import { downloadFile } from '@/lib/utils';

function inlineNodesToMarkdown(nodes: JSONContent[]): string {
  return nodes.map(node => {
    if (node.type === 'text') {
      let text = node.text || '';
      const marks = node.marks || [];
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold': text = `**${text}**`; break;
          case 'italic': text = `*${text}*`; break;
          case 'underline': text = `<u>${text}</u>`; break;
          case 'strike': text = `~~${text}~~`; break;
        }
      }
      return text;
    }
    if (node.content) {
      return inlineNodesToMarkdown(node.content);
    }
    return '';
  }).join('');
}

function listItemToMarkdown(item: JSONContent): string {
  if (!item.content) return '';
  return item.content.map(child => {
    if (child.type === 'paragraph') {
      return inlineNodesToMarkdown(child.content || []);
    }
    return '';
  }).join(' ');
}

function jsonContentToMarkdown(doc: JSONContent | null): string {
  if (!doc || !doc.content) return '';

  const lines: string[] = [];

  for (const node of doc.content) {
    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level ?? 1;
        const prefix = '#'.repeat(level);
        const text = inlineNodesToMarkdown(node.content || []);
        lines.push(`${prefix} ${text}`, '');
        break;
      }
      case 'paragraph': {
        const text = inlineNodesToMarkdown(node.content || []);
        lines.push(text, '');
        break;
      }
      case 'bulletList': {
        for (const item of node.content || []) {
          const text = listItemToMarkdown(item);
          lines.push(`- ${text}`);
        }
        lines.push('');
        break;
      }
      case 'orderedList': {
        let idx = 1;
        for (const item of node.content || []) {
          const text = listItemToMarkdown(item);
          lines.push(`${idx}. ${text}`);
          idx++;
        }
        lines.push('');
        break;
      }
      case 'blockquote': {
        const inner = (node.content || []).map(child => {
          if (child.type === 'paragraph') {
            return `> ${inlineNodesToMarkdown(child.content || [])}`;
          }
          return '';
        }).join('\n');
        lines.push(inner, '');
        break;
      }
      case 'horizontalRule':
        lines.push('---', '');
        break;
      default: {
        const text = inlineNodesToMarkdown(node.content || []);
        if (text) lines.push(text, '');
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Export chapters to Markdown format
 */
export async function exportToMarkdown(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  const parts: string[] = [`# ${title}`, ''];

  for (const chapter of chapters) {
    if (includeHeadings) {
      parts.push(`## ${chapter.title}`, '');
    }

    const markdown = jsonContentToMarkdown(chapter.content);
    if (markdown) {
      parts.push(markdown, '');
    }
  }

  const output = parts.join('\n').trim();
  downloadFile(output, `${title}.md`, 'text/markdown;charset=utf-8');
}
