import { getDb } from "../story_bible/storage";

export async function putModelChunk(id: string, data: Blob): Promise<void> {
  const db = await getDb();
  await db.put("model_chunks", { id, data, size: data.size, updatedAt: Date.now() });
}

export async function hasModelChunk(id: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.get("model_chunks", id);
  return Boolean(row);
}

export async function loadModelChunk(id: string): Promise<Blob | undefined> {
  const db = await getDb();
  const row = await db.get("model_chunks", id);
  return row?.data;
}
