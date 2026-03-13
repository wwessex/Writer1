// Plugin API types
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  hooks: string[];
}

export interface PluginHook {
  event: string;
  handler: (...args: unknown[]) => void;
}
