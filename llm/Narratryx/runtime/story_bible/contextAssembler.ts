import type { SceneChunk, StoryBibleCard } from "./schema";

export interface ContextBudget {
  system: number;
  cards: number;
  world: number;
  outline: number;
  recent: number;
  summary: number;
  headroom: number;
}

const DEFAULT_BUDGET: ContextBudget = {
  system: 500,
  cards: 1000,
  world: 500,
  outline: 200,
  recent: 4000,
  summary: 500,
  headroom: 800,
};

const takeByChars = (text: string, maxTokensApprox: number) => text.slice(0, maxTokensApprox * 4);

export function assemblePromptContext(params: {
  systemPrompt: string;
  sceneOutline: string;
  rollingSummary: string;
  activeCards: StoryBibleCard[];
  activeChunks: SceneChunk[];
  budget?: Partial<ContextBudget>;
}) {
  const budget = { ...DEFAULT_BUDGET, ...params.budget };

  const cardText = params.activeCards
    .map((c) => (c.type === "character" ? `${c.name}: ${c.personality.join(", ")}` : `${c.title}: ${(c.rules || []).join(", ")}`))
    .join("\n");

  const recentText = params.activeChunks.map((c) => c.text).join("\n\n");

  return {
    system: takeByChars(params.systemPrompt, budget.system),
    cards: takeByChars(cardText, budget.cards + budget.world),
    outline: takeByChars(params.sceneOutline, budget.outline),
    recent: takeByChars(recentText, budget.recent),
    summary: takeByChars(params.rollingSummary, budget.summary),
    generationHeadroomTokens: budget.headroom,
  };
}
