/**
 * Story Bible — runtime context assembly for AI inference.
 *
 * Bridges the app's continuity memory, chapter data, and user-defined
 * entities into a structured context payload that can be injected into
 * AI prompts. Enforces a token budget so context never exceeds the
 * model's capacity.
 *
 * This module is the runtime counterpart of the Narratryx training
 * pipeline's Story Bible concept (llm/Narratryx/docs/architecture.md).
 */

import type { Chapter } from '@/types';
import { editorToPlainText } from '@/lib/utils';
import type { ContinuityMemorySnapshot } from '@/lib/continuityMemory';
import type { StoryBibleContext, StoryBibleEntity } from './types';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORY_BIBLE_STORAGE_KEY = 'draftharbour_story_bible';
const DEFAULT_TOKEN_BUDGET = 2048;
const APPROX_CHARS_PER_TOKEN = 4;

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */

export interface StoredStoryBible {
  novelId: string;
  updatedAt: number;
  entities: StoryBibleEntity[];
  styleNotes: string;
}

export function loadStoryBible(novelId: string): StoredStoryBible | null {
  try {
    const raw = localStorage.getItem(`${STORY_BIBLE_STORAGE_KEY}_${novelId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStoryBible;
    if (parsed.novelId !== novelId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoryBible(bible: StoredStoryBible): void {
  if (!bible.novelId) return;
  localStorage.setItem(`${STORY_BIBLE_STORAGE_KEY}_${bible.novelId}`, JSON.stringify(bible));
}

/* ------------------------------------------------------------------ */
/*  Entity extraction from continuity memory                           */
/* ------------------------------------------------------------------ */

function extractEntitiesFromContinuity(snapshot: ContinuityMemorySnapshot): StoryBibleEntity[] {
  const entities: StoryBibleEntity[] = [];

  for (const character of snapshot.characters) {
    const attrParts = Object.entries(character.attributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    const relParts = character.relationships.slice(0, 3).join('; ');
    const description = [attrParts, relParts ? `relationships: ${relParts}` : ''].filter(Boolean).join('. ');

    entities.push({
      name: character.canonicalName,
      type: 'character',
      description: description || 'Character in the story',
      triggerKeywords: [character.canonicalName.toLowerCase(), character.key],
    });
  }

  return entities;
}

/* ------------------------------------------------------------------ */
/*  Scene summary generation                                           */
/* ------------------------------------------------------------------ */

function buildRecentSceneSummaries(chapters: Chapter[], activeChapterId: string | null, maxScenes: number = 5): string[] {
  const sorted = chapters.slice().sort((a, b) => a.order - b.order);
  const activeIdx = activeChapterId
    ? sorted.findIndex(c => c.id === activeChapterId)
    : sorted.length;
  const relevantChapters = sorted.slice(Math.max(0, activeIdx - maxScenes), activeIdx);

  return relevantChapters.map(ch => {
    if (ch.summary?.trim()) return `[${ch.title}] ${ch.summary}`;
    const text = editorToPlainText(ch.content) || '';
    const truncated = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    return `[${ch.title}] ${truncated}${text.length > 200 ? '...' : ''}`;
  }).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Saliency ranking                                                   */
/* ------------------------------------------------------------------ */

function computeKeywordScore(entity: StoryBibleEntity, contextText: string): number {
  const lower = contextText.toLowerCase();
  let score = 0;
  for (const keyword of entity.triggerKeywords) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) score += matches.length;
  }
  return score;
}

function rankEntitiesBySaliency(entities: StoryBibleEntity[], contextText: string): StoryBibleEntity[] {
  return entities
    .map(entity => ({ entity, score: computeKeywordScore(entity, contextText) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.entity);
}

/* ------------------------------------------------------------------ */
/*  Context assembly with token budget                                 */
/* ------------------------------------------------------------------ */

function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

export function assembleStoryBibleContext(
  novelId: string,
  chapters: Chapter[],
  activeChapterId: string | null,
  continuitySnapshot: ContinuityMemorySnapshot | null,
  tokenBudget: number = DEFAULT_TOKEN_BUDGET,
): StoryBibleContext {
  const stored = loadStoryBible(novelId);
  const contextText = chapters
    .map(ch => editorToPlainText(ch.content) || '')
    .join(' ')
    .slice(0, 10000);

  // Merge entities: stored bible entities + auto-extracted from continuity
  let allEntities: StoryBibleEntity[] = stored?.entities ?? [];
  if (continuitySnapshot) {
    const continuityEntities = extractEntitiesFromContinuity(continuitySnapshot);
    const existingNames = new Set(allEntities.map(e => e.name.toLowerCase()));
    for (const ce of continuityEntities) {
      if (!existingNames.has(ce.name.toLowerCase())) {
        allEntities.push(ce);
      }
    }
  }

  // Rank by saliency to the current context
  allEntities = rankEntitiesBySaliency(allEntities, contextText);

  // Build scene summaries
  const recentSceneSummaries = buildRecentSceneSummaries(chapters, activeChapterId);

  // Style notes
  const styleNotes = stored?.styleNotes ?? '';

  // Apply token budget — greedily include entities until budget exhausted
  let usedTokens = estimateTokens(styleNotes);
  for (const summary of recentSceneSummaries) {
    usedTokens += estimateTokens(summary);
  }

  const budgetedEntities: StoryBibleEntity[] = [];
  for (const entity of allEntities) {
    const entityTokens = estimateTokens(`${entity.name}: ${entity.description}`);
    if (usedTokens + entityTokens > tokenBudget) break;
    budgetedEntities.push(entity);
    usedTokens += entityTokens;
  }

  return {
    entities: budgetedEntities,
    recentSceneSummaries,
    styleNotes,
    tokenBudget,
  };
}

/**
 * Format a StoryBibleContext into a plain-text block for prompt injection.
 */
export function formatStoryBibleForPrompt(context: StoryBibleContext): string {
  const parts: string[] = [];

  if (context.entities.length > 0) {
    const entityLines = context.entities
      .map(e => `- ${e.name} (${e.type}): ${e.description}`)
      .join('\n');
    parts.push(`Story Bible:\n${entityLines}`);
  }

  if (context.recentSceneSummaries.length > 0) {
    parts.push(`Recent scenes:\n${context.recentSceneSummaries.map(s => `- ${s}`).join('\n')}`);
  }

  if (context.styleNotes) {
    parts.push(`Style guide: ${context.styleNotes}`);
  }

  return parts.join('\n\n');
}
