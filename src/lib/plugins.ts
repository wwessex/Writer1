/**
 * Plugin API for third-party extensions.
 * Provides an event-based hook system, UI extension points,
 * sandboxed storage, and a community plugin registry interface.
 */

import type { PluginManifest } from '@/types';

type EventHandler = (...args: unknown[]) => void;
type FilterHandler = (value: unknown) => unknown;

export interface PluginUISlot {
  id: string;
  pluginId: string;
  slot: 'toolbar' | 'sidebar' | 'statusbar' | 'menu' | 'editor-footer';
  render: () => HTMLElement;
  priority: number;
}

export interface PluginStorage {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  clear(): void;
}

export interface PluginContext {
  pluginId: string;
  on: (event: string, handler: EventHandler) => void;
  off: (event: string, handler: EventHandler) => void;
  emit: (event: string, ...args: unknown[]) => void;
  filter: (name: string, handler: FilterHandler) => void;
  registerUISlot: (slot: Omit<PluginUISlot, 'id' | 'pluginId'>) => string;
  unregisterUISlot: (slotId: string) => void;
  storage: PluginStorage;
  getAvailableEvents: () => string[];
  getAvailableFilters: () => string[];
}

class PluginManager {
  private plugins: Map<string, PluginManifest> = new Map();
  private hooks: Map<string, EventHandler[]> = new Map();
  private filters: Map<string, FilterHandler[]> = new Map();
  private enabled: Set<string> = new Set();
  private uiSlots: Map<string, PluginUISlot> = new Map();
  private activations: Map<string, () => void> = new Map();

  /** Register a plugin with its manifest */
  register(manifest: PluginManifest): void {
    this.plugins.set(manifest.id, manifest);
    this.enabled.add(manifest.id);
    console.log(`[Plugin] Registered: ${manifest.name} v${manifest.version}`);
  }

  /** Unregister a plugin */
  unregister(pluginId: string): void {
    // Call deactivation if registered
    const deactivate = this.activations.get(pluginId);
    if (deactivate) {
      try { deactivate(); } catch (err) { console.error(`[Plugin] Deactivation error:`, err); }
      this.activations.delete(pluginId);
    }

    this.plugins.delete(pluginId);
    this.enabled.delete(pluginId);

    // Remove all hooks registered by this plugin
    this.hooks.forEach((handlers, event) => {
      this.hooks.set(event, handlers.filter(h => {
        const meta = (h as unknown as { __pluginId?: string }).__pluginId;
        return meta !== pluginId;
      }));
    });

    // Remove all filters registered by this plugin
    this.filters.forEach((handlers, name) => {
      this.filters.set(name, handlers.filter(h => {
        const meta = (h as unknown as { __pluginId?: string }).__pluginId;
        return meta !== pluginId;
      }));
    });

    // Remove UI slots
    this.uiSlots.forEach((slot, id) => {
      if (slot.pluginId === pluginId) this.uiSlots.delete(id);
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

  /** Register a filter (transforms a value through a chain) */
  registerFilter(name: string, handler: FilterHandler, pluginId?: string): void {
    const handlers = this.filters.get(name) || [];
    if (pluginId) {
      (handler as unknown as { __pluginId?: string }).__pluginId = pluginId;
    }
    handlers.push(handler);
    this.filters.set(name, handlers);
  }

  /** Apply filters to a value */
  applyFilters(name: string, initialValue: unknown): unknown {
    const handlers = this.filters.get(name) || [];
    let value = initialValue;
    for (const handler of handlers) {
      const pluginId = (handler as unknown as { __pluginId?: string }).__pluginId;
      if (pluginId && !this.enabled.has(pluginId)) continue;
      try {
        value = handler(value);
      } catch (err) {
        console.error(`[Plugin] Error in filter ${name}:`, err);
      }
    }
    return value;
  }

  /** Register a UI slot */
  registerUISlot(pluginId: string, slot: Omit<PluginUISlot, 'id' | 'pluginId'>): string {
    const id = `${pluginId}__${slot.slot}__${crypto.randomUUID().slice(0, 8)}`;
    this.uiSlots.set(id, { ...slot, id, pluginId });
    return id;
  }

  /** Unregister a UI slot */
  unregisterUISlot(slotId: string): void {
    this.uiSlots.delete(slotId);
  }

  /** Get UI slots for a specific location */
  getUISlots(location: PluginUISlot['slot']): PluginUISlot[] {
    return Array.from(this.uiSlots.values())
      .filter(s => s.slot === location && this.enabled.has(s.pluginId))
      .sort((a, b) => a.priority - b.priority);
  }

  /** Create a sandboxed storage for a plugin */
  createStorage(pluginId: string): PluginStorage {
    const prefix = `novelwriter_plugin_${pluginId}_`;
    return {
      get(key: string): unknown {
        try {
          const data = localStorage.getItem(`${prefix}${key}`);
          return data ? JSON.parse(data) : undefined;
        } catch { return undefined; }
      },
      set(key: string, value: unknown): void {
        localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
      },
      remove(key: string): void {
        localStorage.removeItem(`${prefix}${key}`);
      },
      clear(): void {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) keys.push(key);
        }
        keys.forEach(k => localStorage.removeItem(k));
      },
    };
  }

  /** Create a context for a plugin to interact with the system */
  createContext(pluginId: string): PluginContext {
    return {
      pluginId,
      on: (event, handler) => this.on(event, handler, pluginId),
      off: (event, handler) => this.off(event, handler),
      emit: (event, ...args) => this.emit(event, ...args),
      filter: (name, handler) => this.registerFilter(name, handler, pluginId),
      registerUISlot: (slot) => this.registerUISlot(pluginId, slot),
      unregisterUISlot: (slotId) => this.unregisterUISlot(slotId),
      storage: this.createStorage(pluginId),
      getAvailableEvents: () => this.getAvailableEvents(),
      getAvailableFilters: () => this.getAvailableFilters(),
    };
  }

  /** Register a deactivation callback for cleanup */
  registerDeactivation(pluginId: string, fn: () => void): void {
    this.activations.set(pluginId, fn);
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
      'sync:export:before',
      'sync:export:after',
      'sync:import:before',
      'sync:import:after',
      'sync:pull:normalized',
      'sync:conflict',
      'save:before',
      'save:after',
      'theme:change',
      'settings:change',
      'plugin:registered',
      'plugin:unregistered',
      'collab:commentAdded',
      'collab:commentResolved',
      'analytics:computed',
    ];
  }

  /** Get all available filters */
  getAvailableFilters(): string[] {
    return [
      'export:content',
      'export:filename',
      'import:content',
      'editor:toolbar',
      'editor:shortcuts',
      'chapter:defaultContent',
      'analysis:results',
      'sync:payload',
    ];
  }
}

// Singleton instance
export const pluginManager = new PluginManager();

// Expose to window for third-party plugins
if (typeof window !== 'undefined') {
  (window as unknown as {
    NovelWriterPlugins: PluginManager;
    NovelWriterPluginAPI: {
      register: (manifest: PluginManifest, activate: (ctx: PluginContext) => (() => void) | void) => void;
      unregister: (id: string) => void;
    };
  }).NovelWriterPlugins = pluginManager;

  // Convenience API for community plugins
  (window as unknown as {
    NovelWriterPluginAPI: {
      register: (manifest: PluginManifest, activate: (ctx: PluginContext) => (() => void) | void) => void;
      unregister: (id: string) => void;
    };
  }).NovelWriterPluginAPI = {
    register(manifest: PluginManifest, activate: (ctx: PluginContext) => (() => void) | void) {
      pluginManager.register(manifest);
      const ctx = pluginManager.createContext(manifest.id);
      const deactivate = activate(ctx);
      if (typeof deactivate === 'function') {
        pluginManager.registerDeactivation(manifest.id, deactivate);
      }
    },
    unregister(id: string) {
      pluginManager.unregister(id);
    },
  };
}
