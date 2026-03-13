import type { StoryBlueprint } from '@/types';
import { STORY_BLUEPRINTS_STORAGE_KEY } from '@/lib/storageKeys';

function loadStoryBlueprints(): Record<string, StoryBlueprint> {
  try {
    const raw = localStorage.getItem(STORY_BLUEPRINTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, StoryBlueprint>;
  } catch {
    return {};
  }
}

function saveStoryBlueprints(blueprints: Record<string, StoryBlueprint>): void {
  localStorage.setItem(STORY_BLUEPRINTS_STORAGE_KEY, JSON.stringify(blueprints));
}

export function getStoryBlueprint(novelId: string): StoryBlueprint | null {
  const blueprints = loadStoryBlueprints();
  return blueprints[novelId] || null;
}

export function upsertStoryBlueprint(novelId: string, blueprint: StoryBlueprint): void {
  const blueprints = loadStoryBlueprints();
  blueprints[novelId] = blueprint;
  saveStoryBlueprints(blueprints);
}

export function deleteStoryBlueprint(novelId: string): void {
  const blueprints = loadStoryBlueprints();
  delete blueprints[novelId];
  saveStoryBlueprints(blueprints);
}
