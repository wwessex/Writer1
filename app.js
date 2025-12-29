// app.js — main UI + state
import {
  ensureDefaultNovel,
  getNovel,
  updateNovelTitle,
  createChapter,
  updateChapterMeta,
  deleteChapter,
  reorderChapters,
  exportBackup,
  importBackup,
  resetAllData
} from "./storage.js";

import { createNovelEditor, setEditorDoc, bindToolbar } from "./editor.js";


async function replaceNovelWithImport(parsed) {
  // Backward-compatible importer: does NOT rely on storage.js exporting replaceFromImport.
  // Uses existing exported storage operations.
  const novelTitle = parsed?.novelTitle || "Untitled Novel";
  const chapters = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
  if (!chapters.length) throw new Error("No chapters to import");

  // Update novel title
  await updateNovelTitle(state.novelId, novelTitle);

  // Delete existing chapters
  const current = await getNovel(state.novelId);
  for (const c of (current.chapters || [])) {
    await deleteChapter(c.id);
  }

  // Create new chapters + set content
  const newIds = [];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i] || {};
    const title = ch.title || `Chapter ${i + 1}`;
    const created = await createChapter(state.novelId, title);
    await updateChapterMeta(created.id, {
      title,
      order: i + 1,
      content: ch.doc || { type: "doc", content: [{ type: "paragraph" }] }
    });
    newIds.push(created.id);
  }

  // Ensure final order
  await reorderChapters(state.novelId, newIds);
}

/* ---------------------------
  Small utilities
--------------------------- */
const $ = (sel) => document.querySelector(sel);

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function setStatus(text) {
  $("#saveStatus").textContent = text;
}

// Word counts (fast, no heavy deps)
function countWordsInString(s) {
  if (!s) return 0;
  const m = String(s).match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g);
  return m ? m.length : 0;
}
function countWordsFromJson(node) {
  if (!node) return 0;
  if (node.type === "text") return countWordsInString(node.text || "");
  let sum = 0;
  const c = node.content || [];
  for (const child of c) sum += countWordsFromJson(child);
  return sum;
}
const updateCountsDebounced = debounce(() => {
  try {
    const active = state.chapters.find(c => c.id === state.activeChapterId);
    const chapterWords = active?.content ? countWordsFromJson(active.content) : 0;
    const totalWords = state.chapters.reduce((acc, c) => acc + (c.content ? countWordsFromJson(c.content) : 0), 0);
    $("#chapterWords") && ($("#chapterWords").textContent = chapterWords.toLocaleString());
    $("#totalWords") && ($("#totalWords").textContent = totalWords.toLocaleString());
    const wc = document.getElementById("wordCountModal");
    if (wc && wc.open) {
      $("#wcChapter") && ($("#wcChapter").textContent = chapterWords.toLocaleString());
      $("#wcTotal") && ($("#wcTotal").textContent = totalWords.toLocaleString());
    }
  } catch {}
}, 500);

function setConnectionPill() {
  const online = navigator.onLine;
  const pill = $("#connPill");
  const text = $("#connText");
  if (text) text.textContent = online ? "Online" : "Offline";
  if (pill) {
    pill.classList.toggle("is-offline", !online);
    pill.classList.toggle("is-online", online);
  }
}

function applyViewPrefs() {
  document.body.classList.toggle("pageView", !!state.pageView);
  document.body.classList.toggle("sidebarHidden", !!state.sidebarHidden);
}

function applyTheme() {
  const t = (state.theme === "light") ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
}

function updateThemeButton() {
  const btn = $("#btnTheme");
  const icon = btn?.querySelector('.material-symbols-rounded');
  if (!btn || !icon) return;
  const isLight = (document.documentElement.getAttribute('data-theme') === 'light');
  icon.textContent = isLight ? 'light_mode' : 'dark_mode';
  btn.title = isLight ? 'Switch to dark' : 'Switch to light';
}

function updateHeaderHeight() {
  const header = document.querySelector('.appHeader');
  if (!header) return;
  const h = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--headerH', `${h}px`);
}

/* ---------------------------
  Service Worker
--------------------------- */
(async function setupSW() {
  const params = new URLSearchParams(location.search);
  if (params.get("nosw") === "1") {
    // Unregister SW if requested
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    return;
  }

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (e) {
      console.warn("SW registration failed:", e);
    }
  }
})();

/* ---------------------------
  App State
--------------------------- */
const state = {
  novelId: "default",
  pageView: true,
  sidebarHidden: false,
  theme: "dark",
  novelTitle: "Untitled Novel",
  chapters: [],
  activeChapterId: null,
  autosaveMs: 800,
  sync: {
    novelId: "default",
    url: "",
    auth: ""
  }
};

// Persist small settings (not content) in localStorage
const SETTINGS_KEY = "novelwriter_settings_v1";

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (typeof s.autosaveMs === "number") state.autosaveMs = s.autosaveMs;
    if (s.sync) state.sync = { ...state.sync, ...s.sync };
    if (typeof s.pageView === "boolean") state.pageView = s.pageView;
    if (typeof s.sidebarHidden === "boolean") state.sidebarHidden = s.sidebarHidden;
    if (typeof s.theme === "string") state.theme = s.theme;
  } catch {}
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autosaveMs: state.autosaveMs, sync: state.sync, pageView: state.pageView, sidebarHidden: state.sidebarHidden, theme: state.theme }));
}

/* ---------------------------
  Editor
--------------------------- */
let editor = null;
let autosaveDebounced = null;

function configureAutosave() {
  autosaveDebounced = debounce(async () => {
    const id = state.activeChapterId;
    if (!id) return;
    // editor updates feed chapter content via onUpdate handler
    setStatus("Saved locally");
  }, state.autosaveMs);
}

function onEditorUpdate(jsonDoc) {
  const id = state.activeChapterId;
  if (!id) return;
  const ch = state.chapters.find(c => c.id === id);
  if (!ch) return;
  ch.content = jsonDoc;
  ch.updatedAt = Date.now();
  // async write to IndexedDB (debounced)
  writeChapterDebounced(id, { content: jsonDoc });
  updateCountsDebounced();
}

const writeChapterDebounced = debounce(async (id, patch) => {
  try {
    await updateChapterMeta(id, patch);
    setStatus(navigator.onLine ? "Saved (online)" : "Saved (offline)");
  } catch (e) {
    console.warn(e);
    setStatus("Save failed (check storage)");
  }
}, 350);

/* ---------------------------
  Chapter list rendering + drag reorder
--------------------------- */
function renderChapters() {
  const ul = $("#chaptersList");
  ul.innerHTML = "";

  for (const ch of state.chapters) {
    const li = document.createElement("li");
    li.className = "chapterItem" + (ch.id === state.activeChapterId ? " is-active" : "");
    li.draggable = true;
    li.dataset.id = ch.id;

    li.innerHTML = `
      <div class="dragHandle" title="Drag to reorder"></div>
      <div class="chapterName">${escapeHtml(ch.title || "Untitled")}</div>
      <div class="chapterMeta">${formatMiniDate(ch.updatedAt)}</div>
    `;

    li.addEventListener("click", () => openChapter(ch.id));
    bindDragHandlers(li);
    ul.appendChild(li);
  }
}

function bindDragHandlers(li) {
  li.addEventListener("dragstart", (e) => {
    li.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", li.dataset.id);
  });

  li.addEventListener("dragend", () => {
    li.classList.remove("is-dragging");
    document.querySelectorAll(".chapterItem").forEach(el => el.classList.remove("is-dragover"));
  });

  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    li.classList.add("is-dragover");
    e.dataTransfer.dropEffect = "move";
  });

  li.addEventListener("dragleave", () => li.classList.remove("is-dragover"));

  li.addEventListener("drop", async (e) => {
    e.preventDefault();
    li.classList.remove("is-dragover");
    const draggedId = e.dataTransfer.getData("text/plain");
    const targetId = li.dataset.id;
    if (!draggedId || draggedId === targetId) return;

    const ids = state.chapters.map(c => c.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;

    ids.splice(to, 0, ids.splice(from, 1)[0]);
    // reorder state.chapters accordingly
    state.chapters = ids.map(id => state.chapters.find(c => c.id === id));
    renderChapters();

    try {
      await reorderChapters(state.novelId, ids);
      setStatus("Chapters reordered");
    } catch (err) {
      console.warn(err);
      setStatus("Reorder failed");
    }
  });
}

/* ---------------------------
  Chapter open/save
--------------------------- */
async function openChapter(id) {
  if (id === state.activeChapterId) return;

  // Save title of current chapter before switching
  await flushChapterTitle();

  state.activeChapterId = id;
  const ch = state.chapters.find(c => c.id === id);
  $("#chapterTitle").value = ch?.title || "";

  // Load content into editor (isolated per chapter)
  setEditorDoc(editor, ch?.content);
  renderChapters();
  updateCountsDebounced();
}

async function flushChapterTitle() {
  const id = state.activeChapterId;
  if (!id) return;
  const title = $("#chapterTitle").value.trim() || "Untitled Chapter";
  const ch = state.chapters.find(c => c.id === id);
  if (!ch) return;
  if (ch.title !== title) {
    ch.title = title;
    ch.updatedAt = Date.now();
    renderChapters();
    try { await updateChapterMeta(id, { title }); } catch {}
  }
}

/* ---------------------------
  Online Sync (optional)
--------------------------- */
function setSyncStatus(text) {
  $("#syncStatus").textContent = text;
}

async function syncNow({ direction = "push" } = {}) {
  const url = state.sync.url?.trim();
  const remoteNovelId = state.sync.novelId?.trim();
  if (!url || !remoteNovelId) {
    setSyncStatus("Set Sync URL + Novel ID first.");
    return;
  }

  const headers = { "Content-Type": "application/json" };
  if (state.sync.auth?.trim()) headers["Authorization"] = state.sync.auth.trim();

  setSyncStatus("Syncing…");

  try {
    if (direction === "pull") {
      const res = await fetch(`${url.replace(/\/$/, "")}/novels/${encodeURIComponent(remoteNovelId)}`, { headers });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const remote = await res.json();
      await importBackup(remote);
      await loadFromDB();
      setSyncStatus("Pulled from server.");
      setStatus("Synced");
      return;
    }

    // push
    const payload = await exportBackup(state.novelId);
    // save settings inside payload for portability? no (server stores novel only)
    const res = await fetch(`${url.replace(/\/$/, "")}/novels/${encodeURIComponent(remoteNovelId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Push failed: ${res.status}`);
    setSyncStatus("Pushed to server.");
    setStatus("Synced");
  } catch (e) {
    console.warn(e);
    setSyncStatus("Sync failed (check server / connection).");
    setStatus("Offline-ready (not synced)");
  }
}

/* ---------------------------
  Boot
--------------------------- */
async function loadFromDB() {
  const { novel, chapters } = await getNovel(state.novelId);
  state.novelTitle = novel?.title || "Untitled Novel";
  state.chapters = chapters || [];

  $("#novelTitle").value = state.novelTitle;
  $("#docTitleTop") && ($("#docTitleTop").value = state.novelTitle);

  // Ensure an active chapter
  if (!state.activeChapterId || !state.chapters.some(c => c.id === state.activeChapterId)) {
    state.activeChapterId = state.chapters[0]?.id || null;
  }
  renderChapters();

  const active = state.chapters.find(c => c.id === state.activeChapterId);
  $("#chapterTitle").value = active?.title || "";
  setEditorDoc(editor, active?.content);
  updateCountsDebounced();
}

async function boot() {
  loadSettings();
  applyTheme();
  applyViewPrefs();
  updateHeaderHeight();
  updateThemeButton();
  requestAnimationFrame(() => updateHeaderHeight());
  setTimeout(updateHeaderHeight, 250);

  await ensureDefaultNovel();

  editor = createNovelEditor({
    element: $("#editor"),
    onUpdate: onEditorUpdate
  });

  bindToolbar(editor, $("#toolbar"));
  configureAutosave();

  // Style dropdown (Word-ish)
  $("#styleSelect")?.addEventListener("change", (e) => {
    const v = e.target.value;
    const btn = document.querySelector(`.tb[data-cmd="${v}"]`);
    if (btn) btn.click();
    // fallback actions
    if (v === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
    if (v === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
    if (v === "p") editor.chain().focus().setParagraph().run();
    if (v === "quote") editor.chain().focus().toggleBlockquote().run();
  });

  await loadFromDB();

  setStatus(navigator.onLine ? "Ready" : "Ready (offline)");
  setConnectionPill();

  // Header toggles
  $("#btnToggleSidebar")?.addEventListener("click", () => {
    state.sidebarHidden = !state.sidebarHidden;
    applyViewPrefs();
    updateHeaderHeight();
    saveSettings();
  });

  $("#btnTheme")?.addEventListener("click", () => {
    state.theme = (state.theme === "light") ? "dark" : "light";
    applyTheme();
    updateThemeButton();
    saveSettings();
  });

  // Optional: system theme (press & hold, then release on iOS; right-click on desktop)
  $("#btnTheme")?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    state.theme = prefersLight ? "light" : "dark";
    applyTheme();
    updateThemeButton();
    saveSettings();
  });

  // Events

  $("#novelTitle").addEventListener("input", debounce(async (e) => {
    const title = e.target.value.trim() || "Untitled Novel";
    state.novelTitle = title;
    $("#docTitleTop") && ($("#docTitleTop").value = title);
    await updateNovelTitle(state.novelId, title);
    setStatus("Saved locally");
  }, 250));

  // Top title (Docs-like)
  $("#docTitleTop")?.addEventListener("input", debounce(async (e) => {
    const title = e.target.value.trim() || "Untitled Novel";
    state.novelTitle = title;
    $("#novelTitle") && ($("#novelTitle").value = title);
    await updateNovelTitle(state.novelId, title);
    setStatus("Saved locally");
  }, 250));

  $("#chapterTitle").addEventListener("input", () => autosaveDebounced?.());
  $("#chapterTitle").addEventListener("blur", flushChapterTitle);

  $("#btnNewChapter").addEventListener("click", async () => {
    const chap = await createChapter(state.novelId, `Chapter ${state.chapters.length + 1}`);
    state.chapters.push(chap);
    await openChapter(chap.id);
    renderChapters();
    setStatus("Chapter added");
  });

  $("#btnDeleteChapter").addEventListener("click", async () => {
    const id = state.activeChapterId;
    if (!id) return;
    const ch = state.chapters.find(c => c.id === id);
    const ok = confirm(`Delete "${ch?.title || "this chapter"}"? This cannot be undone.`);
    if (!ok) return;

    await deleteChapter(id);
    state.chapters = state.chapters.filter(c => c.id !== id);
    state.activeChapterId = state.chapters[0]?.id || null;
    renderChapters();
    if (state.activeChapterId) await openChapter(state.activeChapterId);
    setStatus("Chapter deleted");
  });

  // Backup export/import
  $("#btnBackup").addEventListener("click", async () => {
    await flushChapterTitle();
    const payload = await exportBackup(state.novelId);
    downloadJSON(payload, `${safeFilename(state.novelTitle)}_backup_${nowStamp()}.json`);
  });

  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await importBackup(payload);
      state.novelId = payload.novel?.id || "default";
      state.activeChapterId = null;
      await loadFromDB();
      setStatus("Backup imported");
    } catch (err) {
      console.warn(err);
      alert("Import failed: invalid backup file.");
    } finally {
      e.target.value = "";
    }
  });


  $("#importDocRtf").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = confirm("Importing a Word/RTF file will replace your current chapters in this novel. Continue?");
    if (!ok) { e.target.value = ""; return; }

    try {
      setStatus("Importing document…");
      const mod = await import("./importer.js");
      const parsed = await mod.parseImportFile(file);

      await replaceNovelWithImport(parsed);

      state.activeChapterId = null;
      await loadFromDB();
      setStatus("Imported Word/RTF");
    } catch (err) {
      console.warn(err);
      alert("Import failed: " + (err?.message || err));
      setStatus("Import failed");
    } finally {
      e.target.value = "";
    }
  });

  // Export modal
  const exportModal = $("#exportModal");
  $("#btnExport").addEventListener("click", () => exportModal.showModal());

  const getExportData = async () => {
    await flushChapterTitle();
    const includeHeadings = $("#exportIncludeChapterHeadings").checked;
    // refresh chapters from DB to ensure latest order + titles
    const { novel, chapters } = await getNovel(state.novelId);
    return { novelTitle: novel?.title, chapters, includeHeadings };
  };

  $("#exportDocx").addEventListener("click", async () => {
    setStatus("Exporting DOCX…");
    const data = await getExportData();
    const mod = await import("./export.js");
    await mod.exportDOCX(data);
    setStatus("Exported DOCX");
  });

  $("#exportPdf").addEventListener("click", async () => {
    setStatus("Exporting PDF…");
    const data = await getExportData();
    const mod = await import("./export.js");
    await mod.exportPDF(data);
    setStatus("Exported PDF");
  });

  $("#exportRtf").addEventListener("click", async () => {
    setStatus("Exporting RTF…");
    const data = await getExportData();
    const mod = await import("./export.js");
    await mod.exportRTF(data);
    setStatus("Exported RTF");
  });

  // Settings modal
  const settingsModal = $("#settingsModal");
  $("#btnSettings").addEventListener("click", () => {
    $("#syncNovelId").value = state.sync.novelId || "default";
    $("#syncUrl").value = state.sync.url || "";
    $("#syncAuth").value = state.sync.auth || "";
    $("#autosaveMs").value = String(state.autosaveMs);
    $("#syncStatus").textContent = "";
    settingsModal.showModal();
  });

  $("#autosaveMs").addEventListener("change", (e) => {
    const ms = Math.max(250, Math.min(5000, Number(e.target.value || 800)));
    state.autosaveMs = ms;
    configureAutosave();
    saveSettings();
    setStatus("Settings saved");
  });

  $("#syncNovelId").addEventListener("input", debounce((e) => {
    state.sync.novelId = e.target.value.trim();
    saveSettings();
  }, 200));
  $("#syncUrl").addEventListener("input", debounce((e) => {
    state.sync.url = e.target.value.trim();
    saveSettings();
  }, 200));
  $("#syncAuth").addEventListener("input", debounce((e) => {
    state.sync.auth = e.target.value;
    saveSettings();
  }, 200));

  $("#btnSyncNow").addEventListener("click", async () => {
    await syncNow({ direction: "push" });
  });

  $("#btnResetApp").addEventListener("click", async () => {
    const ok = confirm("Reset ALL local NovelWriter data on this device/browser?");
    if (!ok) return;
    await resetAllData();
    location.reload();
  });


  setupMenus();

  // Keep layout correct as the header wraps (iOS, orientation changes)
  window.addEventListener("resize", () => updateHeaderHeight());
  window.addEventListener("orientationchange", () => setTimeout(updateHeaderHeight, 50));

  // Online/offline status
  window.addEventListener("online", () => { setStatus("Online"); setConnectionPill(); });
  window.addEventListener("offline", () => { setStatus("Offline"); setConnectionPill(); });
}

function formatMiniDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${dd}/${mm}`;
}
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function safeFilename(name) {
  return (name || "novel").replace(/[^a-z0-9\-\_\s]/gi, "").trim().replace(/\s+/g, "_").slice(0, 80) || "novel";
}


function setupMenus() {
  const menus = {
    file: $("#menu-file"),
    edit: $("#menu-edit"),
    view: $("#menu-view"),
    insert: $("#menu-insert"),
    format: $("#menu-format"),
    tools: $("#menu-tools"),
    help: $("#menu-help")
  };

  const closeAllMenus = () => {
    document.querySelectorAll(".menuBtn").forEach(b => b.classList.remove("is-open"));
    Object.values(menus).forEach(m => {
      if (!m) return;
      m.classList.remove("is-open");
      // Ensure inline display doesn't keep it visible
      m.style.display = "none";
      const menusRoot = document.querySelector(".menus");
      if (menusRoot && m.parentElement === document.body) menusRoot.appendChild(m);
    });
  };

  // Position menu under clicked button
  const openMenu = (key, btn) => {
    closeAllMenus();
    const menu = menus[key];
    const menusRoot = document.querySelector(".menus");
    if (!menu) return;

    // Make it visible for measurement/positioning
    menu.style.display = "block";
    menu.classList.add("is-open");
    menu.style.position = "fixed";
    menu.style.zIndex = "10000";

    // iOS Safari: avoid stacking-context issues by placing menu at <body> while open
    if (menu.parentElement !== document.body) {
      menu.dataset._home = "1";
      document.body.appendChild(menu);
    }

    const rect = btn.getBoundingClientRect();
    // Measure after display
    const mrect = menu.getBoundingClientRect();

    // Default placement: under the menubar button
    let left = rect.left;
    let top = rect.bottom + 6;

    // Clamp within viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (left + mrect.width > vw - 8) left = vw - mrect.width - 8;
    if (left < 8) left = 8;

    // If there's not enough space below, open upward
    if (top + mrect.height > vh - 8 && rect.top > mrect.height + 8) {
      top = rect.top - mrect.height - 6;
    }
    if (top < 8) top = 8;

    menu.style.left = Math.round(left) + "px";
    menu.style.top = Math.round(top) + "px";

    btn.classList.add("is-open");
  };

  document.querySelectorAll(".menuBtn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = btn.dataset.menu;
      const menu = menus[key];
    const menusRoot = document.querySelector(".menus");
      const isOpen = menu?.classList.contains("is-open");
      if (isOpen) closeAllMenus();
      else openMenu(key, btn);
    });
  });

  document.addEventListener("click", (e) => {
    const inMenu = e.target.closest(".menubar") || e.target.closest(".menu");
    if (!inMenu) closeAllMenus();
  });

  // Menu actions
  document.querySelectorAll(".menuItem").forEach(item => {
    item.addEventListener("click", async () => {
      const a = item.dataset.action;
      closeAllMenus();

      switch (a) {
        case "export":
          $("#exportModal").showModal();
          break;
        case "backup-export":
          $("#btnBackup").click();
          break;
        case "backup-import":
          // trigger existing file input (hidden inside sidebar label)
          $("#importFile").click();
          break;
        case "import-docrtf":
          $("#importDocRtf").click();
          break;
        case "settings":
          $("#btnSettings").click();
          break;
        case "undo":
          editor?.commands.undo();
          break;
        case "redo":
          editor?.commands.redo();
          break;
        case "select-all":
          document.getSelection()?.selectAllChildren(document.querySelector(".ProseMirror"));
          break;
        case "toggle-sidebar":
          state.sidebarHidden = !state.sidebarHidden;
          applyViewPrefs();
  updateHeaderHeight();
          saveSettings();
          break;
        case "toggle-page":
          state.pageView = !state.pageView;
          applyViewPrefs();
  updateHeaderHeight();
          saveSettings();
          break;
        case "hr":
          editor?.chain().focus().setHorizontalRule().run();
          break;
        case "blockquote":
          editor?.chain().focus().toggleBlockquote().run();
          break;
        case "bold":
          editor?.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor?.chain().focus().toggleItalic().run();
          break;
        case "underline":
          editor?.chain().focus().toggleUnderline().run();
          break;
        case "h1":
          editor?.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "h2":
          editor?.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "p":
          editor?.chain().focus().setParagraph().run();
          break;
        case "word-count":
          // Populate modal from pills (already updated)
          $("#wcChapter") && ($("#wcChapter").textContent = $("#chapterWords")?.textContent || "0");
          $("#wcTotal") && ($("#wcTotal").textContent = $("#totalWords")?.textContent || "0");
          $("#wordCountModal").showModal();
          break;
        case "about":
          $("#aboutModal").showModal();
          break;
        default:
          break;
      }
    });
  });
}

boot().catch((e) => {
  console.error(e);
  setStatus("App error");
  alert("NovelWriter hit an error. Open DevTools Console for details.");
});
