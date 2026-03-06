/**
 * ePub export for DraftHarbour Studio.
 *
 * Generates ePub 3.0 files client-side using JSZip for packaging.
 * Maps chapters to XHTML sections with proper metadata and TOC.
 */

import type { Chapter } from '@/types';
import { editorToPlainText } from '@/lib/utils';

export interface EpubMetadata {
  title: string;
  author: string;
  description: string;
  language: string;
  publisher: string;
  date: string;
  identifier: string;
}

interface EpubChapter {
  title: string;
  content: string;
  filename: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chapterToXhtml(title: string, paragraphs: string[]): string {
  const body = paragraphs
    .map(p => `    <p>${escapeXml(p)}</p>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" href="../styles/default.css" />
</head>
<body>
  <section epub:type="chapter">
    <h1>${escapeXml(title)}</h1>
${body}
  </section>
</body>
</html>`;
}

function generateContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;
}

function generateContentOpf(metadata: EpubMetadata, chapters: EpubChapter[]): string {
  const manifestItems = chapters
    .map((ch, i) => `    <item id="chapter${i + 1}" href="text/${ch.filename}" media-type="application/xhtml+xml" />`)
    .join('\n');

  const spineItems = chapters
    .map((_, i) => `    <itemref idref="chapter${i + 1}" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(metadata.identifier)}</dc:identifier>
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author)}</dc:creator>
    <dc:language>${escapeXml(metadata.language)}</dc:language>
    <dc:description>${escapeXml(metadata.description)}</dc:description>
    <dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>
    <dc:date>${escapeXml(metadata.date)}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="styles/default.css" media-type="text/css" />
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`;
}

function generateNavXhtml(chapters: EpubChapter[]): string {
  const toc = chapters
    .map(ch => `      <li><a href="text/${ch.filename}">${escapeXml(ch.title)}</a></li>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8" />
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${toc}
    </ol>
  </nav>
</body>
</html>`;
}

function generateDefaultCss(): string {
  return `body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  margin: 1em;
  color: #333;
}

h1 {
  font-size: 1.5em;
  margin-bottom: 1em;
  page-break-before: always;
  text-align: center;
}

p {
  margin: 0;
  text-indent: 1.5em;
}

p:first-of-type {
  text-indent: 0;
}
`;
}

export async function exportToEpub(
  chapters: Chapter[],
  metadata: EpubMetadata,
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  // mimetype must be first file, uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF
  zip.file('META-INF/container.xml', generateContainerXml());

  // Prepare chapters
  const epubChapters: EpubChapter[] = chapters.map((chapter, index) => {
    const text = chapter.content ? editorToPlainText(chapter.content) : '';
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

    return {
      title: chapter.title || `Chapter ${index + 1}`,
      content: chapterToXhtml(chapter.title || `Chapter ${index + 1}`, paragraphs),
      filename: `chapter${String(index + 1).padStart(3, '0')}.xhtml`,
    };
  });

  // OEBPS content
  zip.file('OEBPS/content.opf', generateContentOpf(metadata, epubChapters));
  zip.file('OEBPS/nav.xhtml', generateNavXhtml(epubChapters));
  zip.file('OEBPS/styles/default.css', generateDefaultCss());

  for (const chapter of epubChapters) {
    zip.file(`OEBPS/text/${chapter.filename}`, chapter.content);
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
