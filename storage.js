// storage.js — IndexedDB via Dexie + small helpers

import Dexie from "https://esm.sh/dexie@4.0.8";

export const db = new Dexie("NovelWriterDB");
db.version(1).stores({
  // single novel (for now)
  novels: "id, title, updatedAt",
  chapters: "id, novelId, order, title, updatedAt"
});

export async function ensureDefaultNovel() {
  const existing = await db.novels.get("default");
  if (existing) return existing;

  const now = Date.now();
  const novel = { id: "default", title: "Untitled Novel", updatedAt: now };
  await db.novels.put(novel);

  // Seed with one chapter
  const chapId = crypto.randomUUID();
  await db.chapters.put({
    id: chapId,
    novelId: "default",
    order: 1,
    title: "Chapter 1",
    updatedAt: now,
    // Tiptap JSON document (StarterKit)
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Start writing…" }] }]
    }
  });

  return novel;
}

export async function getNovel(novelId = "default") {
  const novel = await db.novels.get(novelId);
  const chapters = await db.chapters.where({ novelId }).sortBy("order");
  return { novel, chapters };
}

export async function updateNovelTitle(novelId, title) {
  const n = await db.novels.get(novelId);
  if (!n) return;
  n.title = title;
  n.updatedAt = Date.now();
  await db.novels.put(n);
}

export async function createChapter(novelId, title = "New Chapter") {
  const now = Date.now();
  const chapters = await db.chapters.where({ novelId }).toArray();
  const maxOrder = chapters.reduce((m, c) => Math.max(m, c.order || 0), 0);

  const chap = {
    id: crypto.randomUUID(),
    novelId,
    order: maxOrder + 1,
    title,
    updatedAt: now,
    content: { type: "doc", content: [{ type: "paragraph" }] }
  };
  await db.chapters.put(chap);
  return chap;
}

export async function updateChapterMeta(id, patch) {
  const c = await db.chapters.get(id);
  if (!c) return;
  Object.assign(c, patch, { updatedAt: Date.now() });
  await db.chapters.put(c);
  return c;
}

export async function deleteChapter(id) {
  await db.chapters.delete(id);
}

export async function reorderChapters(novelId, orderedIds) {
  // orderedIds: array of chapter ids in new order
  const now = Date.now();
  await db.transaction("rw", db.chapters, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const c = await db.chapters.get(id);
      if (!c || c.novelId !== novelId) continue;
      c.order = i + 1;
      c.updatedAt = now;
      await db.chapters.put(c);
    }
  });
}

export async function exportBackup(novelId = "default") {
  const payload = await getNovel(novelId);
  payload.exportedAt = new Date().toISOString();
  payload.schemaVersion = 1;
  return payload;
}

export async function importBackup(payload) {
  if (!payload || payload.schemaVersion !== 1) throw new Error("Unsupported backup format");
  const { novel, chapters } = payload;
  if (!novel?.id || !Array.isArray(chapters)) throw new Error("Invalid backup");

  await db.transaction("rw", db.novels, db.chapters, async () => {
    await db.novels.put({ ...novel, updatedAt: Date.now() });
    // remove existing chapters for that novel id
    await db.chapters.where({ novelId: novel.id }).delete();
    for (const c of chapters) {
      await db.chapters.put({ ...c, novelId: novel.id, updatedAt: Date.now() });
    }
  });
  return true;
}


export async function replaceFromImport(novelId, novelTitle, chapters) {
  if (!novelId) novelId = "default";
  if (!Array.isArray(chapters) || !chapters.length) throw new Error("No chapters to import");

  const now = Date.now();
  await db.transaction("rw", db.novels, db.chapters, async () => {
    const n = await db.novels.get(novelId);
    if (!n) {
      await db.novels.put({ id: novelId, title: novelTitle || "Untitled Novel", updatedAt: now });
    } else {
      n.title = novelTitle || n.title || "Untitled Novel";
      n.updatedAt = now;
      await db.novels.put(n);
    }

    await db.chapters.where({ novelId }).delete();

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      await db.chapters.put({
        id: crypto.randomUUID(),
        novelId,
        order: i + 1,
        title: ch.title || `Chapter ${i + 1}`,
        updatedAt: now,
        content: ch.doc || { type: "doc", content: [{ type: "paragraph" }] }
      });
    }
  });
  return true;
}

export async function resetAllData() {
  await db.delete();
  // Dexie needs re-open after delete
  db.open();
}
