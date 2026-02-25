/**
 * Scrivener integration adapter.
 * Imports .scriv projects (as ZIP) by parsing the .scrivx XML binder and
 * reading content files. Exports chapters as a .scriv-compatible ZIP.
 */

import type { Chapter, IntegrationConfig } from '@/types';
import { normalizeProviderPullResponse } from './orchestration';
import type { IntegrationAdapter, ProviderDocument, ProviderPayload, RemoteRevision } from './types';

interface BinderItem {
  uuid: string;
  title: string;
  type: string;
  children: BinderItem[];
}

/**
 * Parse a Scrivener .scrivx XML string to extract the binder structure.
 */
function parseScrivxBinder(xml: string): BinderItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  function parseBinderItem(element: Element): BinderItem {
    const uuid = element.getAttribute('UUID') || '';
    const titleEl = element.querySelector(':scope > Title');
    const title = titleEl?.textContent || 'Untitled';
    const type = element.getAttribute('Type') || 'Text';

    const children: BinderItem[] = [];
    const childrenEl = element.querySelector(':scope > Children');
    if (childrenEl) {
      const childItems = childrenEl.querySelectorAll(':scope > BinderItem');
      childItems.forEach((child) => {
        children.push(parseBinderItem(child));
      });
    }

    return { uuid, title, type, children };
  }

  const items: BinderItem[] = [];
  const binderEl = doc.querySelector('Binder');
  if (binderEl) {
    const topItems = binderEl.querySelectorAll(':scope > BinderItem');
    topItems.forEach((item) => {
      items.push(parseBinderItem(item));
    });
  }

  return items;
}

/**
 * Flatten binder items into a list of text documents (skipping folders, trash, etc.)
 */
function flattenTextItems(items: BinderItem[]): BinderItem[] {
  const result: BinderItem[] = [];

  for (const item of items) {
    // Skip special Scrivener folders
    if (item.title === 'Trash' || item.type === 'TrashFolder') continue;

    if (item.type === 'Text') {
      result.push(item);
    }

    // Recurse into children (folders like "Draft", "Research", etc.)
    if (item.children.length > 0) {
      result.push(...flattenTextItems(item.children));
    }
  }

  return result;
}

/**
 * Strip RTF formatting to extract plain text.
 */
function rtfToPlainText(rtf: string): string {
  let text = rtf;

  // Remove RTF groups and commands
  text = text.replace(/\{\\[^{}]*\}/g, '');
  text = text.replace(/\\pard[^\\]*/g, '');
  text = text.replace(/\\par\b/g, '\n');
  text = text.replace(/\\line\b/g, '\n');
  text = text.replace(/\\tab\b/g, '\t');
  text = text.replace(/\\[a-z]+\d*\s?/gi, '');
  text = text.replace(/[{}]/g, '');

  // Decode common RTF escape sequences
  text = text.replace(/\\'([0-9a-f]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  text = text.replace(/\\~/g, '\u00A0');
  text = text.replace(/\\-/g, '\u00AD');
  text = text.replace(/\\\\/g, '\\');

  return text.trim();
}

/**
 * Open a file picker for .scriv ZIP files and return the selected File.
 */
function pickScrivFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.scriv';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected.'));
      }
    });

    input.addEventListener('cancel', () => {
      reject(new Error('File selection cancelled.'));
    });

    input.click();
  });
}

/**
 * Read entries from a ZIP file using the browser's native capabilities.
 * Falls back to manual ZIP parsing for basic .scriv structures.
 */
async function readZipEntries(file: File): Promise<Map<string, string>> {
  // Use JSZip if available (it's already a project dependency)
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const entries = new Map<string, string>();
  const fileEntries = Object.entries(zip.files).filter(([, entry]) => !entry.dir);

  for (const [path, entry] of fileEntries) {
    try {
      const content = await entry.async('string');
      entries.set(path, content);
    } catch {
      // Skip binary files that can't be read as text
    }
  }

  return entries;
}

/**
 * Generate a .scriv-compatible ZIP for export.
 */
async function generateScrivZip(
  projectName: string,
  chapters: ProviderDocument[]
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const projectDir = zip.folder(`${projectName}.scriv`);
  if (!projectDir) throw new Error('Failed to create project directory in ZIP.');

  const filesDir = projectDir.folder('Files');
  const dataDir = filesDir?.folder('Data');

  // Build binder items for the .scrivx manifest
  const binderItems = chapters.map((ch, index) => {
    const uuid = ch.id.replace(/-/g, '').slice(0, 16).toUpperCase().padEnd(16, '0');

    // Create content file for this chapter
    const chapterDir = dataDir?.folder(uuid);
    chapterDir?.file('content.txt', ch.body);

    return `      <BinderItem UUID="${uuid}" Type="Text" Created="${new Date(ch.updatedAt).toISOString()}" Modified="${new Date(ch.updatedAt).toISOString()}">
        <Title>${escapeXml(ch.title)}</Title>
        <MetaData>
          <SortOrder>${index}</SortOrder>
        </MetaData>
      </BinderItem>`;
  });

  // Create the .scrivx manifest
  const scrivxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="2.0">
  <Binder>
    <BinderItem UUID="DRAFT0000000000" Type="DraftFolder" Created="${new Date().toISOString()}" Modified="${new Date().toISOString()}">
      <Title>Draft</Title>
      <Children>
${binderItems.join('\n')}
      </Children>
    </BinderItem>
    <BinderItem UUID="TRASH0000000000" Type="TrashFolder" Created="${new Date().toISOString()}" Modified="${new Date().toISOString()}">
      <Title>Trash</Title>
    </BinderItem>
  </Binder>
</ScrivenerProject>`;

  projectDir.file(`${projectName}.scrivx`, scrivxContent);

  return zip.generateAsync({ type: 'blob' });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Trigger a file download in the browser.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const scrivenerAdapter: IntegrationAdapter = {
  type: 'scrivener',

  async connect(_config: IntegrationConfig) {
    return {
      message: 'Scrivener integration ready. Use Import to open a .scriv ZIP or Export to save.',
      syncedAt: Date.now(),
    };
  },

  async testConnection(_config: IntegrationConfig) {
    // Scrivener is local-only, no connection needed
    return {
      message: 'Scrivener integration is available. Select a .scriv ZIP file to import.',
      syncedAt: Date.now(),
    };
  },

  async pull(_config: IntegrationConfig, _payload: ProviderPayload, localChapters: Chapter[]) {
    // Open file picker for the user to select a .scriv ZIP
    const file = await pickScrivFile();

    // Read the ZIP contents
    const entries = await readZipEntries(file);

    // Find the .scrivx manifest file
    let scrivxContent: string | null = null;
    let basePath = '';
    for (const [path, content] of entries) {
      if (path.endsWith('.scrivx')) {
        scrivxContent = content;
        basePath = path.substring(0, path.lastIndexOf('/') + 1);
        break;
      }
    }

    if (!scrivxContent) {
      throw new Error('Invalid Scrivener project: no .scrivx manifest found in the ZIP file.');
    }

    // Parse the binder structure
    const binderItems = parseScrivxBinder(scrivxContent);
    const textItems = flattenTextItems(binderItems);

    if (textItems.length === 0) {
      return {
        chapterUpdates: localChapters,
        remoteRevision: `scrivener-empty-${Date.now()}`,
        conflicts: [],
      };
    }

    // Read content for each text item
    const remoteDocs: ProviderDocument[] = [];
    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i];
      let body = '';

      // Try multiple content file locations (Scrivener uses different structures)
      const contentPaths = [
        `${basePath}Files/Data/${item.uuid}/content.rtf`,
        `${basePath}Files/Data/${item.uuid}/content.txt`,
        `${basePath}Files/Docs/${item.uuid}.rtf`,
        `${basePath}Files/Docs/${item.uuid}.txt`,
      ];

      for (const contentPath of contentPaths) {
        const fileContent = entries.get(contentPath);
        if (fileContent) {
          body = contentPath.endsWith('.rtf') ? rtfToPlainText(fileContent) : fileContent;
          break;
        }
      }

      remoteDocs.push({
        id: item.uuid,
        title: item.title,
        body,
        order: i,
        updatedAt: Date.now(),
      });
    }

    const remoteRevision = `scrivener-import-${Date.now()}`;
    return await normalizeProviderPullResponse(localChapters, remoteDocs, remoteRevision, 'scrivener');
  },

  async push(_config: IntegrationConfig, payload: ProviderPayload) {
    const projectName = payload.novelId ? `DraftHarbour_${payload.novelId.slice(0, 8)}` : 'DraftHarbour_Export';

    const blob = await generateScrivZip(projectName, payload.chapters);
    downloadBlob(blob, `${projectName}.scriv.zip`);

    return {
      message: `Exported ${payload.chapters.length} chapter(s) as Scrivener project "${projectName}.scriv.zip".`,
      syncedAt: Date.now(),
    };
  },

  async listRemoteRevisions(_config: IntegrationConfig): Promise<RemoteRevision[]> {
    // Scrivener is file-based, no remote revisions
    return [];
  },
};
