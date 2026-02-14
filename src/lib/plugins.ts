/**
 * Plugin API for third-party extensions.
 * Provides an event-based hook system for extending NovelWriter.
 */

import type { PluginManifest } from '@/types';

type EventHandler = (...args: unknown[]) => void;

class PluginManager {
  private plugins: Map<string, PluginManifest> = new Map();
  private hooks: Map<string, EventHandler[]> = new Map();
  private enabled: Set<string> = new Set();

  /** Register a plugin with its manifest */
  register(manifest: PluginManifest): void {
    this.plugins.set(manifest.id, manifest);
    this.enabled.add(manifest.id);
    console.log(`[Plugin] Registered: ${manifest.name} v${manifest.version}`);
  }

  /** Unregister a plugin */
  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
    this.enabled.delete(pluginId);
    // Remove all hooks registered by this plugin
    this.hooks.forEach((handlers, event) => {
      this.hooks.set(event, handlers.filter(h => {
        const meta = (h as unknown as { __pluginId?: string }).__pluginId;
        return meta !== pluginId;
      }));
    });
    console.log(`[Plugin] Unregistered: ${pluginId}`);
  }

  /** Enable a plugin */
  enable(pluginId: string): void {
    this.enabled.add(pluginId);
  }

  /** Disable a plugin */
  disable(pluginId: string): void {
    this.enabled.delete(pluginId);
  }

  /** Check if a plugin is enabled */
  isEnabled(pluginId: string): boolean {
    return this.enabled.has(pluginId);
  }

  /** Subscribe to an event */
  on(event: string, handler: EventHandler, pluginId?: string): void {
    const handlers = this.hooks.get(event) || [];
    if (pluginId) {
      (handler as unknown as { __pluginId?: string }).__pluginId = pluginId;
    }
    handlers.push(handler);
    this.hooks.set(event, handlers);
  }

  /** Unsubscribe from an event */
  off(event: string, handler: EventHandler): void {
    const handlers = this.hooks.get(event) || [];
    this.hooks.set(event, handlers.filter(h => h !== handler));
  }

  /** Emit an event to all registered handlers */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.hooks.get(event) || [];
    for (const handler of handlers) {
      const pluginId = (handler as unknown as { __pluginId?: string }).__pluginId;
      if (pluginId && !this.enabled.has(pluginId)) continue;

      try {
        handler(...args);
      } catch (err) {
        console.error(`[Plugin] Error in ${event} handler:`, err);
      }
    }
  }

  /** Get all registered plugins */
  getPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  /** Get registered plugin by ID */
  getPlugin(id: string): PluginManifest | undefined {
    return this.plugins.get(id);
  }

  /** Get all available events */
  getAvailableEvents(): string[] {
    return [
      'chapter:create',
      'chapter:delete',
      'chapter:update',
      'chapter:reorder',
      'chapter:select',
      'novel:titleChange',
      'editor:contentChange',
      'editor:selectionChange',
      'export:before',
      'export:after',
      'import:before',
      'import:after',
      'save:before',
      'save:after',
      'theme:change',
      'settings:change'
    ];
  }
}

// Singleton instance
export const pluginManager = new PluginManager();

// Expose to window for third-party plugins
if (typeof window !== 'undefined') {
  (window as unknown as { NovelWriterPlugins: PluginManager }).NovelWriterPlugins = pluginManager;
}
