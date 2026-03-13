import type { SceneChunk, StoryBibleCard } from "./schema";

export interface SaliencyResult {
  activeCards: StoryBibleCard[];
  activeChunks: SceneChunk[];
}

function scoreKeywordMatch(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((acc, k) => (lower.includes(k.toLowerCase()) ? acc + 1 : acc), 0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function rankSaliency(params: {
  sceneText: string;
  sceneEmbedding?: number[];
  cards: StoryBibleCard[];
  chunks: SceneChunk[];
  topCards?: number;
  topChunks?: number;
}): SaliencyResult {
  const { sceneText, sceneEmbedding, cards, chunks, topCards = 4, topChunks = 6 } = params;

  const rankedCards = [...cards]
    .map((card) => ({ card, score: scoreKeywordMatch(sceneText, card.triggerKeywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topCards)
    .map((x) => x.card);

  const rankedChunks = [...chunks]
    .map((chunk) => {
      const keywordScore = scoreKeywordMatch(sceneText, chunk.keywords);
      const semanticScore = sceneEmbedding && chunk.embedding ? cosineSimilarity(sceneEmbedding, chunk.embedding) : 0;
      return { chunk, score: keywordScore * 0.6 + semanticScore * 0.4 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topChunks)
    .map((x) => x.chunk);

  return { activeCards: rankedCards, activeChunks: rankedChunks };
}
