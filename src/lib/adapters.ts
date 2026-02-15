/**
 * Modular adapter interfaces for external format conversion.
 * Each adapter implements a common interface for import/export
 * to/from different writing tools and services.
 */

import type { Chapter, ProjectType } from '@/types';
import type { JSONContent } from '@tiptap/core';

// ---- Core Adapter Interface ----

export interface AdapterCapabilities {
  canImport: boolean;
  canExport: boolean;
  canSync: boolean;
  supportedFormats: string[];
  requiresAuth: boolean;
}

export interface AdapterMetadata {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  capabilities: AdapterCapabilities;
}

export interface ImportResult {
  chapters: {
    title: string;
    content: JSONContent | null;
    summary?: string;
    order: number;
  }[];
  metadata?: Record<string, string>;
  warnings: string[];
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  blob?: Blob;
  message: string;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  message: string;
}

export interface WritingAdapter {
  metadata: AdapterMetadata;

  /** Test if the adapter can connect/function */
  testConnection(): Promise<{ ok: boolean; message: string }>;

  /** Import content from the external format */
  importContent(file: File | ArrayBuffer, projectType: ProjectType): Promise<ImportResult>;

  /** Export content to the external format */
  exportContent(
    chapters: Chapter[],
    title: string,
    projectType: ProjectType
  ): Promise<ExportResult>;

  /** Bidirectional sync (if supported) */
  sync?(
    chapters: Chapter[],
    novelId: string,
    config: Record<string, string>
  ): Promise<SyncResult>;
}

// ---- Adapter Registry ----

class AdapterRegistry {
  private adapters = new Map<string, WritingAdapter>();

  register(adapter: WritingAdapter): void {
    this.adapters.set(adapter.metadata.id, adapter);
  }

  unregister(id: string): void {
    this.adapters.delete(id);
  }

  get(id: string): WritingAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): WritingAdapter[] {
    return Array.from(this.adapters.values());
  }

  getByCapability(capability: keyof AdapterCapabilities): WritingAdapter[] {
    return this.getAll().filter(a => a.metadata.capabilities[capability]);
  }
}

export const adapterRegistry = new AdapterRegistry();

// ---- Built-in Adapter Stubs ----

export const scrivenerAdapter: WritingAdapter = {
  metadata: {
    id: 'scrivener',
    name: 'Scrivener',
    description: 'Import from and export to Scrivener .scriv project bundles',
    icon: 'edit_note',
    version: '1.0.0',
    capabilities: {
      canImport: true,
      canExport: true,
      canSync: false,
      supportedFormats: ['.scriv', '.scrivx'],
      requiresAuth: false,
    },
  },

  async testConnection() {
    return { ok: true, message: 'Scrivener adapter is available (local file access).' };
  },

  async importContent(_file, _projectType) {
    return {
      chapters: [],
      warnings: ['Scrivener import processes the .scriv bundle structure. Use the Integrations panel for full support.'],
    };
  },

  async exportContent(chapters, title, _projectType) {
    const content = chapters.map(ch => `# ${ch.title}\n\n`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    return {
      success: true,
      filename: `${title}.scriv-outline.txt`,
      blob,
      message: `Exported ${chapters.length} chapters as Scrivener-compatible outline.`,
    };
  },
};

export const googleDocsAdapter: WritingAdapter = {
  metadata: {
    id: 'google-docs',
    name: 'Google Docs',
    description: 'Sync chapters with Google Docs via OAuth',
    icon: 'docs',
    version: '1.0.0',
    capabilities: {
      canImport: true,
      canExport: true,
      canSync: true,
      supportedFormats: ['.gdoc'],
      requiresAuth: true,
    },
  },

  async testConnection() {
    return { ok: false, message: 'Google Docs requires OAuth authentication. Configure in Integrations.' };
  },

  async importContent(_file, _projectType) {
    return { chapters: [], warnings: ['Use the Integrations panel for Google Docs sync.'] };
  },

  async exportContent(_chapters, _title, _projectType) {
    return { success: false, message: 'Use the Integrations panel for Google Docs push.' };
  },

  async sync(_chapters, _novelId, _config) {
    return { pulled: 0, pushed: 0, conflicts: 0, message: 'Google Docs sync requires OAuth. Configure in Integrations.' };
  },
};

export const dropboxAdapter: WritingAdapter = {
  metadata: {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Sync novel backups to Dropbox folders',
    icon: 'cloud_upload',
    version: '1.0.0',
    capabilities: {
      canImport: true,
      canExport: true,
      canSync: true,
      supportedFormats: ['.json'],
      requiresAuth: true,
    },
  },

  async testConnection() {
    return { ok: false, message: 'Dropbox requires OAuth authentication. Configure in Integrations.' };
  },

  async importContent(_file, _projectType) {
    return { chapters: [], warnings: ['Use the Integrations panel for Dropbox sync.'] };
  },

  async exportContent(_chapters, _title, _projectType) {
    return { success: false, message: 'Use the Integrations panel for Dropbox push.' };
  },

  async sync(_chapters, _novelId, _config) {
    return { pulled: 0, pushed: 0, conflicts: 0, message: 'Dropbox sync requires OAuth. Configure in Integrations.' };
  },
};

// Register built-in adapters
adapterRegistry.register(scrivenerAdapter);
adapterRegistry.register(googleDocsAdapter);
adapterRegistry.register(dropboxAdapter);

// Expose registry to window for community plugins
if (typeof window !== 'undefined') {
  (window as unknown as { NovelWriterAdapters: AdapterRegistry }).NovelWriterAdapters = adapterRegistry;
}
