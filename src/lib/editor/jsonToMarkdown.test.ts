import { describe, expect, it } from 'vitest';
import { jsonToMarkdown } from './jsonToMarkdown';

describe('jsonToMarkdown', () => {
  // --- passthrough / edge cases ---

  it('returns input unchanged if already a string', () => {
    expect(jsonToMarkdown('hello world')).toBe('hello world');
  });

  it('returns empty string for null', () => {
    expect(jsonToMarkdown(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(jsonToMarkdown(undefined)).toBe('');
  });

  it('returns empty string for a number', () => {
    expect(jsonToMarkdown(42)).toBe('');
  });

  it('returns empty string for a boolean', () => {
    expect(jsonToMarkdown(true)).toBe('');
  });

  it('returns empty string for a doc with no content', () => {
    expect(jsonToMarkdown({ type: 'doc' })).toBe('');
  });

  // --- paragraphs ---

  it('converts doc with a single paragraph to text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('Hello world');
  });

  it('joins multiple paragraphs with double newlines', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('First\n\nSecond');
  });

  it('returns empty string for a paragraph with no content', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
    expect(jsonToMarkdown(doc)).toBe('');
  });

  // --- headings ---

  it('converts heading level 1', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Title' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('# Title');
  });

  it('converts heading level 2', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Subtitle' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('## Subtitle');
  });

  it('converts heading level 3', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Section' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('### Section');
  });

  it('converts heading level 4', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 4 },
          content: [{ type: 'text', text: 'Subsection' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('#### Subsection');
  });

  it('defaults heading level to 1 when attrs missing', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          content: [{ type: 'text', text: 'No level' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('# No level');
  });

  // --- inline marks ---

  it('converts bold marks to **text**', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('**bold**');
  });

  it('converts italic marks to *text*', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('*italic*');
  });

  it('converts strike marks to ~~text~~', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'struck', marks: [{ type: 'strike' }] },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('~~struck~~');
  });

  it('converts underline marks to <u>text</u>', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'underlined', marks: [{ type: 'underline' }] },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('<u>underlined</u>');
  });

  it('converts code marks to backtick-wrapped text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'code', marks: [{ type: 'code' }] },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('`code`');
  });

  it('converts link marks to [text](href)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click me',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('[click me](https://example.com)');
  });

  it('leaves link text unwrapped if href is missing', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'no link',
              marks: [{ type: 'link' }],
            },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('no link');
  });

  it('stacks multiple marks on the same text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'both',
              marks: [{ type: 'bold' }, { type: 'italic' }],
            },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('***both***');
  });

  it('silently drops commentAnchor marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'noted',
              marks: [{ type: 'commentAnchor', attrs: { id: 'c1' } }],
            },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('noted');
  });

  // --- bullet list ---

  it('converts bulletList to - item lines', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Two' }] },
              ],
            },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('- One\n- Two');
  });

  // --- ordered list ---

  it('converts orderedList to numbered item lines', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Third' }] },
              ],
            },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('1. First\n2. Second\n3. Third');
  });

  // --- blockquote ---

  it('converts blockquote to > prefixed text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Quoted text' }] },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('> Quoted text');
  });

  // --- code block ---

  it('converts codeBlock to fenced code block', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('```\nconst x = 1;\n```');
  });

  it('converts codeBlock with language attribute', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'let y = 2;' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('```typescript\nlet y = 2;\n```');
  });

  // --- horizontal rule ---

  it('converts horizontalRule to ---', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    };
    expect(jsonToMarkdown(doc)).toBe('---');
  });

  // --- image ---

  it('converts image node to ![alt](src)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: 'https://img.example.com/photo.png', alt: 'A photo' },
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('![A photo](https://img.example.com/photo.png)');
  });

  it('converts image with no alt text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: 'https://img.example.com/photo.png' },
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('![](https://img.example.com/photo.png)');
  });

  it('converts inline image within a paragraph', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            { type: 'image', attrs: { src: 'pic.png', alt: 'pic' } },
            { type: 'text', text: ' here' },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('See ![pic](pic.png) here');
  });

  // --- hard break ---

  it('converts hardBreak to newline', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Line one' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Line two' },
          ],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe('Line one\nLine two');
  });

  // --- screenplay blocks ---

  describe('screenplay blocks', () => {
    it('keeps scene-heading starting with INT plain', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'scene-heading' },
            content: [{ type: 'text', text: 'INT. OFFICE - DAY' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('INT. OFFICE - DAY');
    });

    it('keeps scene-heading starting with EXT plain', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'scene-heading' },
            content: [{ type: 'text', text: 'EXT. PARK - NIGHT' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('EXT. PARK - NIGHT');
    });

    it('prefixes scene-heading with . if not starting with INT/EXT', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'scene-heading' },
            content: [{ type: 'text', text: 'THE VOID' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('.THE VOID');
    });

    it('prefixes character name with @', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'character' },
            content: [{ type: 'text', text: 'JOHN' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('@JOHN');
    });

    it('wraps parenthetical in () if not already wrapped', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'parenthetical' },
            content: [{ type: 'text', text: 'whispering' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('(whispering)');
    });

    it('keeps parenthetical unchanged if already wrapped in ()', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'parenthetical' },
            content: [{ type: 'text', text: '(whispering)' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('(whispering)');
    });

    it('prefixes transition with > if not ending with TO:', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'transition' },
            content: [{ type: 'text', text: 'FADE OUT' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('>FADE OUT');
    });

    it('keeps transition unchanged if ending with TO:', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'transition' },
            content: [{ type: 'text', text: 'CUT TO:' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('CUT TO:');
    });

    it('returns dialogue text plain', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'dialogue' },
            content: [{ type: 'text', text: 'Hello there.' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('Hello there.');
    });

    it('returns action text plain', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { screenplayType: 'action' },
            content: [{ type: 'text', text: 'He walks away.' }],
          },
        ],
      };
      expect(jsonToMarkdown(doc)).toBe('He walks away.');
    });
  });

  // --- mixed content ---

  it('handles a complex doc with mixed node types', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Chapter One' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'important', marks: [{ type: 'bold' }] },
            { type: 'text', text: '.' },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'The end.' }],
        },
      ],
    };
    expect(jsonToMarkdown(doc)).toBe(
      '# Chapter One\n\nThis is **important**.\n\n---\n\nThe end.'
    );
  });
});
