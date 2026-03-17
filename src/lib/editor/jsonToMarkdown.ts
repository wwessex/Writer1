/**
 * Converts Tiptap JSONContent to Markdown.
 * Used for the one-time data migration from Tiptap → CodeMirror.
 */

interface JSONNode {
  type?: string;
  text?: string;
  content?: JSONNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

function wrapMarks(text: string, marks?: JSONNode['marks']): string {
  if (!marks || marks.length === 0) return text;
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'link': {
        const href = mark.attrs?.href as string | undefined;
        if (href) result = `[${result}](${href})`;
        break;
      }
      // commentAnchor marks are deliberately dropped during migration;
      // comment thread positions are stored separately in localStorage.
    }
  }
  return result;
}

function inlineContent(nodes: JSONNode[] | undefined): string {
  if (!nodes) return '';
  return nodes.map(node => {
    if (node.type === 'text') {
      return wrapMarks(node.text || '', node.marks);
    }
    if (node.type === 'image') {
      const src = (node.attrs?.src as string) || '';
      const alt = (node.attrs?.alt as string) || '';
      return `![${alt}](${src})`;
    }
    if (node.type === 'hardBreak') return '\n';
    return inlineContent(node.content);
  }).join('');
}

function convertNode(node: JSONNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content || []).map(convertNode).join('\n\n');

    case 'paragraph': {
      const screenplayType = node.attrs?.screenplayType as string | null;
      const text = inlineContent(node.content);
      if (screenplayType) {
        return convertScreenplayBlock(screenplayType, text);
      }
      return text;
    }

    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${inlineContent(node.content)}`;
    }

    case 'bulletList':
      return (node.content || []).map(item => {
        const inner = (item.content || []).map(convertNode).join('\n');
        return `- ${inner}`;
      }).join('\n');

    case 'orderedList':
      return (node.content || []).map((item, i) => {
        const inner = (item.content || []).map(convertNode).join('\n');
        return `${i + 1}. ${inner}`;
      }).join('\n');

    case 'listItem':
      return (node.content || []).map(convertNode).join('\n');

    case 'blockquote':
      return (node.content || []).map(convertNode).map(line =>
        line.split('\n').map(l => `> ${l}`).join('\n')
      ).join('\n');

    case 'codeBlock': {
      const lang = (node.attrs?.language as string) || '';
      const code = inlineContent(node.content);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case 'horizontalRule':
      return '---';

    case 'image': {
      const src = (node.attrs?.src as string) || '';
      const alt = (node.attrs?.alt as string) || '';
      return `![${alt}](${src})`;
    }

    case 'hardBreak':
      return '\n';

    default:
      // Fallback: extract text from unknown node types
      return inlineContent(node.content);
  }
}

function convertScreenplayBlock(type: string, text: string): string {
  // Fountain conventions — scene headings and transitions already uppercase in Tiptap
  switch (type) {
    case 'scene-heading':
      // Force scene heading with '.' prefix if it doesn't start with INT/EXT
      if (/^(INT|EXT|EST|I\/E)/i.test(text)) return text;
      return `.${text}`;
    case 'character':
      // Fountain: uppercase line preceded by blank line (handled by paragraph join)
      return `@${text}`;
    case 'parenthetical':
      // Fountain: text in parens
      if (text.startsWith('(') && text.endsWith(')')) return text;
      return `(${text})`;
    case 'dialogue':
      // Dialogue follows character/parenthetical naturally in Fountain
      return text;
    case 'transition':
      // Force transition with '>' prefix
      if (text.endsWith('TO:') || text.endsWith('TO :')) return text;
      return `>${text}`;
    case 'action':
    default:
      return text;
  }
}

/**
 * Convert a Tiptap JSONContent document to a Markdown string.
 * Returns the input unchanged if it's already a string.
 */
export function jsonToMarkdown(doc: unknown): string {
  if (typeof doc === 'string') return doc;
  if (!doc || typeof doc !== 'object') return '';
  return convertNode(doc as JSONNode);
}
