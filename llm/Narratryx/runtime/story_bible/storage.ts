import { openDB } from "idb";
import type { SceneChunk, StoryBibleCard } from "./schema";

export const DB_NAME = "narratryx_story_bible";
export const DB_VERSION = 1;

export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("cards")) {
        db.createObjectStore("cards", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("scene_chunks")) {
        db.createObjectStore("scene_chunks", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("model_chunks")) {
        db.createObjectStore("model_chunks", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("generation_history")) {
        db.createObjectStore("generation_history", { keyPath: "id" });
      }
    },
  });
}

export async function upsertCard(card: StoryBibleCard): Promise<void> {
  const db = await getDb();
  await db.put("cards", card);
}

export async function upsertSceneChunk(chunk: SceneChunk): Promise<void> {
  const db = await getDb();
  await db.put("scene_chunks", chunk);
}

export async function listCards(): Promise<StoryBibleCard[]> {
  const db = await getDb();
  return db.getAll("cards");
}

export async function listSceneChunks(): Promise<SceneChunk[]> {
  const db = await getDb();
  return db.getAll("scene_chunks");
}
