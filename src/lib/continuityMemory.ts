import type { Chapter } from '@/types';
import { editorToPlainText } from '@/lib/utils';
import { CONTINUITY_STORAGE_PREFIX } from '@/lib/constants/storageKeys';

export interface ContinuityConflict {
  id: string;
  chapterId: string;
  message: string;
  category: 'character' | 'timeline' | 'world' | 'thread';
  severity: 'warning' | 'error';
}

export interface TimelineEventFact {
  id: string;
  label: string;
  chapterId: string;
  chapterTitle: string;
  timestampHint?: string;
}

export interface CharacterContinuityFact {
  key: string;
  canonicalName: string;
  attributes: Record<string, string>;
  relationships: string[];
  seenChapterIds: string[];
}

export interface ContinuityMemorySnapshot {
  novelId: string;
  updatedAt: number;
  characters: CharacterContinuityFact[];
  timelineEvents: TimelineEventFact[];
  worldRules: string[];
  unresolvedThreads: string[];
  conflicts: ContinuityConflict[];
}

function normalizeToken(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

function titleCase(raw: string): string {
  return raw.replace(/\b\w/g, letter => letter.toUpperCase());
}

function ensureCharacter(facts: Map<string, CharacterContinuityFact>, name: string, chapterId: string): CharacterContinuityFact {
  const key = normalizeToken(name);
  const existing = facts.get(key);
  if (existing) {
    if (!existing.seenChapterIds.includes(chapterId)) existing.seenChapterIds.push(chapterId);
    return existing;
  }

  const created: CharacterContinuityFact = {
    key,
    canonicalName: titleCase(key),
    attributes: {},
    relationships: [],
    seenChapterIds: [chapterId],
  };
  facts.set(key, created);
  return created;
}

export function buildContinuityMemory(novelId: string, chapters: Chapter[]): ContinuityMemorySnapshot {
  const characters = new Map<string, CharacterContinuityFact>();
  const timelineEvents: TimelineEventFact[] = [];
  const worldRules = new Set<string>();
  const unresolvedThreads = new Set<string>();
  const conflicts: ContinuityConflict[] = [];

  const sorted = chapters.slice().sort((a, b) => a.order - b.order);

  for (const chapter of sorted) {
    const chapterText = [chapter.title, chapter.summary, editorToPlainText(chapter.content)].filter(Boolean).join('\n');

    for (const match of chapterText.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+(\d{1,3})\s+years?\s+old\b/g)) {
      const character = ensureCharacter(characters, match[1], chapter.id);
      const priorAge = character.attributes.age;
      const newAge = match[2];
      if (priorAge && priorAge !== newAge) {
        conflicts.push({
          id: `character-age-${character.key}-${chapter.id}`,
          chapterId: chapter.id,
          message: `${character.canonicalName} is listed as ${newAge}, but was previously ${priorAge}.`,
          category: 'character',
          severity: 'warning',
        });
      }
      character.attributes.age = newAge;
    }

    for (const match of chapterText.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is|was)\s+the\s+([a-z\s-]+?)\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g)) {
      const source = ensureCharacter(characters, match[1], chapter.id);
      const relation = `${normalizeToken(match[2])} of ${titleCase(normalizeToken(match[3]))}`;
      if (!source.relationships.includes(relation)) {
        source.relationships.push(relation);
      }
    }

    for (const match of chapterText.matchAll(/\bevent:\s*([^\n;]+?)(?:\s+at\s+([^\n;]+))?(?:[.;]|$)/gi)) {
      timelineEvents.push({
        id: `${chapter.id}-${timelineEvents.length + 1}`,
        label: match[1].trim(),
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        timestampHint: match[2]?.trim(),
      });
    }

    for (const match of chapterText.matchAll(/\b(?:rule|law):\s*([^\n;]+)(?:[.;]|$)/gi)) {
      worldRules.add(match[1].trim());
    }

    for (const match of chapterText.matchAll(/\bthread:\s*([^\n;]+?)\s*->\s*(open|resolved)\b/gi)) {
      const thread = match[1].trim();
      const status = match[2].toLowerCase();
      if (status === 'resolved') {
        unresolvedThreads.delete(thread);
      } else {
        unresolvedThreads.add(thread);
      }
    }
  }

  return {
    novelId,
    updatedAt: Date.now(),
    characters: [...characters.values()].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName)),
    timelineEvents,
    worldRules: [...worldRules],
    unresolvedThreads: [...unresolvedThreads],
    conflicts,
  };
}

export function loadContinuityMemory(novelId: string): ContinuityMemorySnapshot | null {
  if (!novelId) return null;
  try {
    const raw = localStorage.getItem(`${CONTINUITY_STORAGE_PREFIX}${novelId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContinuityMemorySnapshot;
    if (parsed.novelId !== novelId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveContinuityMemory(snapshot: ContinuityMemorySnapshot) {
  if (!snapshot.novelId) return;
  localStorage.setItem(`${CONTINUITY_STORAGE_PREFIX}${snapshot.novelId}`, JSON.stringify(snapshot));
}

export function getContinuityMemorySnapshot(novelId: string, chapters: Chapter[]): ContinuityMemorySnapshot {
  const fresh = buildContinuityMemory(novelId, chapters);
  const cached = loadContinuityMemory(novelId);
  if (!cached || cached.updatedAt <= fresh.updatedAt) {
    saveContinuityMemory(fresh);
    return fresh;
  }
  return cached;
}

export function formatContinuityContext(snapshot: ContinuityMemorySnapshot): string {
  const characterLines = snapshot.characters
    .slice(0, 8)
    .map(character => {
      const attrs = Object.entries(character.attributes).map(([key, value]) => `${key}: ${value}`).join(', ');
      const rels = character.relationships.slice(0, 3).join('; ');
      return `- ${character.canonicalName}${attrs ? ` (${attrs})` : ''}${rels ? ` | relationships: ${rels}` : ''}`;
    })
    .join('\n');

  const timelineLines = snapshot.timelineEvents
    .slice(-8)
    .map(event => `- ${event.label}${event.timestampHint ? ` @ ${event.timestampHint}` : ''} (${event.chapterTitle})`)
    .join('\n');

  const worldRuleLines = snapshot.worldRules.slice(0, 8).map(rule => `- ${rule}`).join('\n');
  const threadLines = snapshot.unresolvedThreads.slice(0, 8).map(thread => `- ${thread}`).join('\n');

  return `Continuity canon:\nCharacters:\n${characterLines || '- none'}\nTimeline events:\n${timelineLines || '- none'}\nWorld rules:\n${worldRuleLines || '- none'}\nUnresolved threads:\n${threadLines || '- none'}`;
}
