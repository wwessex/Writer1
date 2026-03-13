export type CardType = "character" | "world" | "lore" | "faction" | "item" | "clue";

export interface CharacterCard {
  id: string;
  type: "character";
  name: string;
  pronouns?: string;
  role?: string;
  personality: string[];
  dialogueStyle?: string[];
  motivations?: { want?: string; need?: string; fear?: string };
  relationships?: Array<{ targetId: string; label: string }>;
  triggerKeywords: string[];
}

export interface WorldCard {
  id: string;
  type: Exclude<CardType, "character">;
  title: string;
  rules?: string[];
  limitations?: string[];
  history?: string;
  narrativePurpose?: string;
  triggerKeywords: string[];
}

export type StoryBibleCard = CharacterCard | WorldCard;

export interface SceneChunk {
  id: string;
  chapterId: string;
  text: string;
  summary?: string;
  embedding?: number[];
  keywords: string[];
}
