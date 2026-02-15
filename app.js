// app.js — main UI + state
import * as storage from "./storage.js";

const {
  ensureDefaultNovel,
  getNovel,
  updateNovelTitle,
  createChapter,
  updateChapterMeta,
  deleteChapter,
  reorderChapters,
  exportBackup,
  importBackup,
  resetAllData,
  createSnapshot,
  loadWindowState,
  saveWindowState,
  clearWindowState
} = storage;

const listSnapshotsForChapter = storage.listSnapshotsForChapter || (async () => []);

import { createNovelEditor, setEditorDoc, bindToolbar, editorToPlainText } from "./editor.js";


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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "final", label: "Final" }
];

function getStatusLabel(value) {
  return STATUS_OPTIONS.find(opt => opt.value === value)?.label || "Draft";
}

// Word counts (fast, no heavy deps)
function countWordsInString(s) {
  if (!s) return 0;
  const m = String(s).match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g);
  return m ? m.length : 0;
}

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","your","you","but","not","are","was","were","have","has","had","into",
  "its","it's","his","her","their","they","them","she","him","our","out","about","what","when","where","which","while",
  "will","can","could","would","should","who","why","how","then","than","there","here","over","under","after","before",
  "because","just","like","also","only","very","been","being","did","does","doing","each","every","some","more","most"
]);

function tokenizeWords(text) {
  return (text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) || []).map(word => word.toLowerCase());
}

/* ---------------------------
  App windows
--------------------------- */
const WINDOW_HIDDEN_CLASS = "is-hidden";
const WINDOW_ACTIVE_CLASS = "is-active";
let windowZ = 10001;
const windowFocusMemory = new Map();

function getAppFrame() {
  return document.querySelector(".layout") || document.body;
}

function getWindowId(windowEl) {
  return windowEl.dataset.windowId || windowEl.id;
}

function getWindowStateFromElement(windowEl, frameRect) {
  const rect = windowEl.getBoundingClientRect();
  // Windows are now position:fixed, so use viewport coordinates directly
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function getDefaultWindowState(windowEl, frameRect) {
  // Use viewport dimensions for fixed positioned windows
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const defaultWidth = Number(windowEl.dataset.defaultWidth);
  const defaultHeight = Number(windowEl.dataset.defaultHeight);
  const width = Math.min(
    Number.isFinite(defaultWidth) ? defaultWidth : Math.min(640, vw - 40),
    vw - 24
  );
  const height = Math.min(
    Number.isFinite(defaultHeight) ? defaultHeight : Math.min(560, vh - 40),
    vh - 24
  );
  const defaultX = Number(windowEl.dataset.defaultX);
  const defaultY = Number(windowEl.dataset.defaultY);
  const x = clamp(
    Number.isFinite(defaultX) ? defaultX : (vw - width) / 2,
    12,
    Math.max(vw - width - 12, 12)
  );
  const y = clamp(
    Number.isFinite(defaultY) ? defaultY : (vh - height) / 2,
    12,
    Math.max(vh - height - 12, 12)
  );
  return { x, y, width, height };
}

function isWindowStateOutOfBounds(state, frameRect) {
  // Use viewport for fixed positioned windows
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Check for invalid/NaN values first
  if (!state || !Number.isFinite(state.x) || !Number.isFinite(state.y) ||
      !Number.isFinite(state.width) || !Number.isFinite(state.height)) {
    return true;
  }
  return (
    state.x < 0 ||
    state.y < 0 ||
    state.x + state.width > vw ||
    state.y + state.height > vh
  );
}

function constrainWindowState(state, frameRect) {
  // Use viewport for fixed positioned windows
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Ensure valid numeric values with fallbacks
  const inputWidth = Number.isFinite(state?.width) ? state.width : 480;
  const inputHeight = Number.isFinite(state?.height) ? state.height : 400;
  const inputX = Number.isFinite(state?.x) ? state.x : 48;
  const inputY = Number.isFinite(state?.y) ? state.y : 32;

  const width = Math.min(Math.max(inputWidth, 320), Math.max(vw - 24, 320));
  const height = Math.min(Math.max(inputHeight, 240), Math.max(vh - 24, 240));
  const x = clamp(inputX, 12, Math.max(vw - width - 12, 12));
  const y = clamp(inputY, 12, Math.max(vh - height - 12, 12));
  return { x, y, width, height };
}

function applyWindowState(windowEl, state) {
  windowEl.style.left = `${state.x}px`;
  windowEl.style.top = `${state.y}px`;
  windowEl.style.width = `${state.width}px`;
  windowEl.style.height = `${state.height}px`;
}

function restoreWindowState(windowEl) {
  const frame = getAppFrame();
  if (!frame) return;
  const frameRect = frame.getBoundingClientRect();
  const windowId = getWindowId(windowEl);
  const saved = loadWindowState(windowId);
  if (saved && !isWindowStateOutOfBounds(saved, frameRect)) {
    applyWindowState(windowEl, constrainWindowState(saved, frameRect));
    return;
  }
  const defaults = getDefaultWindowState(windowEl, frameRect);
  applyWindowState(windowEl, defaults);
  if (saved) clearWindowState(windowId);
  saveWindowState(windowId, defaults);
}

function saveWindowStateFromElement(windowEl) {
  const frame = getAppFrame();
  if (!frame) return;
  const frameRect = frame.getBoundingClientRect();
  const state = constrainWindowState(getWindowStateFromElement(windowEl, frameRect), frameRect);
  applyWindowState(windowEl, state);
  saveWindowState(getWindowId(windowEl), state);
}

function bringWindowToFront(windowEl) {
  windowZ += 1;
  windowEl.style.zIndex = windowZ;
  document.querySelectorAll(".appWindow").forEach(win => {
    const isActive = win === windowEl;
    win.classList.toggle(WINDOW_ACTIVE_CLASS, isActive);
    win.classList.toggle("is-inactive", !isActive);
  });
}

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
  )).filter(el => el.offsetParent !== null);
}

function focusFirstElement(windowEl) {
  const focusable = getFocusableElements(windowEl);
  if (focusable.length) {
    focusable[0].focus();
  } else {
    windowEl.focus();
  }
}

function handleWindowKeydown(windowEl, event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeWindow(windowEl);
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = getFocusableElements(windowEl);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openWindow(windowId) {
  try {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) {
      console.warn("openWindow: element not found:", windowId);
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      windowFocusMemory.set(windowEl, document.activeElement);
    }

    // First make visible so we can measure/position properly
    windowEl.classList.remove(WINDOW_HIDDEN_CLASS);
    windowEl.setAttribute("aria-hidden", "false");

    // Now position it (needs to be visible for measurements)
    restoreWindowState(windowEl);

    // Ensure minimum visibility with fallback positioning
    const rect = windowEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.right < 10 || rect.bottom < 10) {
      // Fallback: position in center of viewport
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      windowEl.style.left = `${Math.max(20, (vw - 500) / 2)}px`;
      windowEl.style.top = `${Math.max(20, (vh - 400) / 2)}px`;
      windowEl.style.width = `${Math.min(500, vw - 40)}px`;
      windowEl.style.height = `${Math.min(400, vh - 40)}px`;
    }

    bringWindowToFront(windowEl);
    focusFirstElement(windowEl);
  } catch (err) {
    console.error("Failed to open window:", windowId, err);
  }
}

function closeWindow(windowElOrId) {
  const windowEl = typeof windowElOrId === "string" ? document.getElementById(windowElOrId) : windowElOrId;
  if (!windowEl) return;
  windowEl.classList.add(WINDOW_HIDDEN_CLASS);
  windowEl.setAttribute("aria-hidden", "true");
  windowEl.classList.remove(WINDOW_ACTIVE_CLASS);
  windowEl.classList.remove("is-inactive");
  const previousFocus = windowFocusMemory.get(windowEl);
  if (previousFocus?.isConnected) {
    previousFocus.focus();
  }
  windowFocusMemory.delete(windowEl);
}

function toggleWindow(windowId) {
  try {
    const windowEl = document.getElementById(windowId);
    if (!windowEl) {
      console.warn("Window not found:", windowId);
      return;
    }
    if (windowEl.classList.contains(WINDOW_HIDDEN_CLASS)) {
      openWindow(windowId);
    } else {
      closeWindow(windowEl);
    }
  } catch (err) {
    console.error("Failed to toggle window:", windowId, err);
  }
}

function setupAppWindows() {
  const frame = getAppFrame();
  if (!frame) return;
  const windows = document.querySelectorAll(".appWindow");
  const saveWindowStateDebounced = debounce((windowEl) => {
    if (!windowEl || windowEl.classList.contains(WINDOW_HIDDEN_CLASS)) return;
    saveWindowStateFromElement(windowEl);
  }, 120);

  windows.forEach(windowEl => {
    const header = windowEl.querySelector(".appWindow__header");
    const id = getWindowId(windowEl);

    windowEl.addEventListener("pointerdown", () => bringWindowToFront(windowEl));
    windowEl.addEventListener("focusin", () => bringWindowToFront(windowEl));
    windowEl.addEventListener("keydown", (event) => handleWindowKeydown(windowEl, event));

    windowEl.querySelectorAll("[data-window-close]").forEach(btn => {
      btn.addEventListener("click", () => closeWindow(windowEl));
    });

    if (header) {
      header.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        if (event.target.closest("button, input, select, textarea")) return;
        bringWindowToFront(windowEl);
        const frameRect = frame.getBoundingClientRect();
        const start = { x: event.clientX, y: event.clientY };
        const startState = getWindowStateFromElement(windowEl, frameRect);
        header.setPointerCapture(event.pointerId);

        const onMove = (moveEvent) => {
          const dx = moveEvent.clientX - start.x;
          const dy = moveEvent.clientY - start.y;
          const next = constrainWindowState({
            x: startState.x + dx,
            y: startState.y + dy,
            width: startState.width,
            height: startState.height
          }, frameRect);
          applyWindowState(windowEl, next);
        };

        const onUp = () => {
          header.releasePointerCapture(event.pointerId);
          header.removeEventListener("pointermove", onMove);
          header.removeEventListener("pointerup", onUp);
          header.removeEventListener("pointercancel", onUp);
          saveWindowStateFromElement(windowEl);
        };

        header.addEventListener("pointermove", onMove);
        header.addEventListener("pointerup", onUp);
        header.addEventListener("pointercancel", onUp);
      });
    }

    const resizeObserver = new ResizeObserver(() => saveWindowStateDebounced(windowEl));
    resizeObserver.observe(windowEl);

    if (!windowEl.classList.contains(WINDOW_HIDDEN_CLASS)) {
      restoreWindowState(windowEl);
      windowEl.setAttribute("aria-hidden", "false");
      bringWindowToFront(windowEl);
    } else {
      windowEl.setAttribute("aria-hidden", "true");
    }

    if (id) {
      windowEl.dataset.windowId = id;
    }
  });

  window.addEventListener("resize", () => {
    document.querySelectorAll(".appWindow").forEach(windowEl => {
      if (!windowEl.classList.contains(WINDOW_HIDDEN_CLASS)) {
        saveWindowStateFromElement(windowEl);
      }
    });
  });
}

/**
 * Safely open a modal dialog with fallback for browsers that don't support showModal
 * @param {string|HTMLDialogElement} modalOrId - The modal element or its ID
 * @returns {boolean} - Whether the modal was successfully opened
 */
function safeShowModal(modalOrId) {
  try {
    const modal = typeof modalOrId === "string" ? document.getElementById(modalOrId) : modalOrId;
    if (!modal) {
      console.warn("Modal not found:", modalOrId);
      return false;
    }

    // Check if the browser supports the dialog element and showModal
    if (typeof modal.showModal === "function") {
      // Close if already open to prevent InvalidStateError
      if (modal.open) {
        modal.close();
      }
      modal.showModal();
      return true;
    }

    // Fallback for browsers without showModal support
    // Make the dialog visible manually
    modal.setAttribute("open", "");
    modal.style.display = "block";
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.zIndex = "100000";

    // Create and add a backdrop
    let backdrop = document.getElementById("modal-fallback-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "modal-fallback-backdrop";
      backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999";
      backdrop.addEventListener("click", () => {
        modal.removeAttribute("open");
        modal.style.display = "";
        backdrop.remove();
      });
      document.body.appendChild(backdrop);
    }
    return true;
  } catch (err) {
    console.error("Failed to open modal:", err);
    return false;
  }
}

function countSyllables(word) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleaned) return 0;
  if (cleaned.length <= 3) return 1;
  const stripped = cleaned.replace(/e$/g, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [];
}

function analyzeText(text) {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const wordCount = words.length;
  const sentenceCount = sentences.length || 1;
  const avgSentenceLength = wordCount ? wordCount / sentenceCount : 0;

  const syllableCount = words.reduce((acc, word) => acc + countSyllables(word), 0);
  const flesch = wordCount
    ? 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount)
    : 0;

  const repeated = new Map();
  words.forEach(word => {
    if (word.length < 4 || STOPWORDS.has(word)) return;
    repeated.set(word, (repeated.get(word) || 0) + 1);
  });
  const topRepeated = [...repeated.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const longSentenceThreshold = 30;
  const longSentences = sentences.filter(sentence => tokenizeWords(sentence).length > longSentenceThreshold);

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength,
    flesch,
    topRepeated,
    longSentenceCount: longSentences.length,
    longSentenceThreshold
  };
}

function getActiveChapterText() {
  flushEditorContent();
  const chapter = state.chapters.find(c => c.id === state.activeChapterId);
  if (!chapter?.content) return "";
  return editorToPlainText(chapter.content);
}

function formatScore(score) {
  if (!Number.isFinite(score)) return "0";
  const rounded = Math.max(0, Math.min(120, Math.round(score)));
  return String(rounded);
}

function readabilityLabel(score) {
  if (score >= 90) return "Very easy";
  if (score >= 80) return "Easy";
  if (score >= 70) return "Fairly easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly hard";
  if (score >= 30) return "Hard";
  return "Very hard";
}

function renderRepeatedWords(listEl, items) {
  listEl.innerHTML = "";
  if (!items.length) {
    listEl.innerHTML = `<div class="muted small">No repeated words above the threshold.</div>`;
    return;
  }
  items.forEach(([word, count]) => {
    const chip = document.createElement("div");
    chip.className = "analysisTag";
    chip.textContent = `${word} (${count})`;
    listEl.appendChild(chip);
  });
}

function renderGrammarResults(listEl, matches) {
  listEl.innerHTML = "";
  if (!matches?.length) {
    listEl.innerHTML = `<div class="muted small">No issues found for the current chapter.</div>`;
    return;
  }
  matches.slice(0, 30).forEach(match => {
    const item = document.createElement("div");
    item.className = "analysisResult";
    const contextText = match.context?.text || "";
    const start = match.context?.offset ?? 0;
    const length = match.context?.length ?? 0;
    const before = contextText.slice(0, start);
    const highlight = contextText.slice(start, start + length);
    const after = contextText.slice(start + length);
    item.innerHTML = `
      <div class="analysisResult__title">${escapeHtml(match.message || "Suggestion")}</div>
      <div class="analysisResult__meta">${escapeHtml(match.rule?.description || "Grammar suggestion")}</div>
      <div class="analysisResult__context">${escapeHtml(before)}<mark>${escapeHtml(highlight)}</mark>${escapeHtml(after)}</div>
    `;
    listEl.appendChild(item);
  });
}

async function runLanguageToolCheck({ text, statusEl, listEl }) {
  if (!state.assist.languageToolEnabled) {
    statusEl.textContent = "Enable LanguageTool in Settings to run grammar checks.";
    renderGrammarResults(listEl, []);
    return;
  }
  if (!state.assist.languageToolUrl) {
    statusEl.textContent = "Set a LanguageTool endpoint in Settings.";
    renderGrammarResults(listEl, []);
    return;
  }
  if (!text.trim()) {
    statusEl.textContent = "Add some text in the active chapter to run a check.";
    renderGrammarResults(listEl, []);
    return;
  }
  statusEl.textContent = "Running grammar and spell check…";
  try {
    const body = new URLSearchParams({
      text,
      language: state.assist.languageToolLanguage || "en-US"
    });
    const res = await fetch(state.assist.languageToolUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!res.ok) throw new Error(`LanguageTool error (${res.status})`);
    const data = await res.json();
    renderGrammarResults(listEl, data.matches || []);
    statusEl.textContent = `Grammar check complete. ${data.matches?.length || 0} suggestion(s) found.`;
  } catch (err) {
    console.warn(err);
    statusEl.textContent = "Unable to reach LanguageTool. Check the endpoint and network.";
  }
}
function countWordsFromJson(node) {
  if (!node) return 0;
  if (node.type === "text") return countWordsInString(node.text || "");
  let sum = 0;
  const c = node.content || [];
  for (const child of c) sum += countWordsFromJson(child);
  return sum;
}
const _chapterWordCache = new Map();
const updateCountsDebounced = debounce(() => {
  try {
    const active = state.chapters.find(c => c.id === state.activeChapterId);
    const chapterWords = active?.content ? countWordsFromJson(active.content) : 0;
    if (state.activeChapterId) _chapterWordCache.set(state.activeChapterId, chapterWords);
    let totalWords = 0;
    for (const c of state.chapters) {
      if (c.id === state.activeChapterId) {
        totalWords += chapterWords;
      } else {
        let cached = _chapterWordCache.get(c.id);
        if (cached === undefined) {
          cached = c.content ? countWordsFromJson(c.content) : 0;
          _chapterWordCache.set(c.id, cached);
        }
        totalWords += cached;
      }
    }
    $("#chapterWords") && ($("#chapterWords").textContent = chapterWords.toLocaleString());
    $("#totalWords") && ($("#totalWords").textContent = totalWords.toLocaleString());
    updateGoalProgress(totalWords);
    const wc = document.getElementById("wordCountModal");
    if (wc && wc.open) {
      $("#wcChapter") && ($("#wcChapter").textContent = chapterWords.toLocaleString());
      $("#wcTotal") && ($("#wcTotal").textContent = totalWords.toLocaleString());
    }
  } catch {}
}, 500);

function refreshAnalysisModal() {
  const text = getActiveChapterText();
  const metrics = analyzeText(text);
  const chapter = state.chapters.find(c => c.id === state.activeChapterId);

  const scopeEl = $("#analysisScope");
  const emptyEl = $("#analysisEmpty");
  if (scopeEl) {
    scopeEl.textContent = chapter?.title ? `Chapter: ${chapter.title}` : "Current chapter";
  }
  if (emptyEl) {
    emptyEl.style.display = text.trim() ? "none" : "block";
  }

  $("#analysisWords") && ($("#analysisWords").textContent = metrics.wordCount.toLocaleString());
  $("#analysisSentences") && ($("#analysisSentences").textContent = metrics.sentenceCount.toLocaleString());
  $("#analysisAvgSentence") && ($("#analysisAvgSentence").textContent = metrics.avgSentenceLength.toFixed(1));
  $("#analysisReadability") && ($("#analysisReadability").textContent = formatScore(metrics.flesch));
  $("#analysisReadabilityLabel") && ($("#analysisReadabilityLabel").textContent = readabilityLabel(metrics.flesch));
  $("#analysisPacingSummary") && ($("#analysisPacingSummary").textContent =
    metrics.longSentenceCount
      ? `${metrics.longSentenceCount} sentence(s) over ${metrics.longSentenceThreshold} words.`
      : "No long sentences detected."
  );

  const repetitionList = $("#analysisRepetition");
  if (repetitionList) renderRepeatedWords(repetitionList, metrics.topRepeated);
}

function openAnalysisModal({ runGrammar = false } = {}) {
  const modal = $("#analysisModal");
  if (!modal) return;
  refreshAnalysisModal();
  safeShowModal(modal);
  if (runGrammar) {
    const statusEl = $("#grammarStatus");
    const listEl = $("#grammarResults");
    const text = getActiveChapterText();
    if (statusEl && listEl) {
      runLanguageToolCheck({ text, statusEl, listEl });
    }
  }
}

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

function populateStatusSelect(select) {
  if (!select) return;
  select.innerHTML = "";
  STATUS_OPTIONS.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });
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

function formatWordCountShort(value) {
  const num = Number(value) || 0;
  if (num >= 1000) {
    const k = num / 1000;
    const rounded = k >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
    return `${rounded}k`;
  }
  return num.toLocaleString();
}

function getDailyBaseline(totalWords) {
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  try {
    const stored = JSON.parse(localStorage.getItem(DAILY_BASELINE_KEY) || "{}");
    if (stored.date === stamp && typeof stored.total === "number") {
      return stored;
    }
  } catch {}
  const baseline = { date: stamp, total: totalWords };
  localStorage.setItem(DAILY_BASELINE_KEY, JSON.stringify(baseline));
  return baseline;
}

function updateGoalProgress(totalWords) {
  const baseline = getDailyBaseline(totalWords);
  const todayWords = Math.max(0, totalWords - baseline.total);
  const dailyGoal = Math.max(0, Number(state.dailyWordGoal || 0));
  const novelGoal = Math.max(0, Number(state.novelWordGoal || 0));
  const todayText = `${todayWords.toLocaleString()}/${dailyGoal.toLocaleString()}`;
  const novelText = `${formatWordCountShort(totalWords)}/${formatWordCountShort(novelGoal)}`;
  $("#todayProgress") && ($("#todayProgress").textContent = todayText);
  $("#novelProgress") && ($("#novelProgress").textContent = novelText);
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
  contextChapterId: null,
  snapshotChapterId: null,
  autosaveMs: 800,
  dailyWordGoal: 0,
  novelWordGoal: 0,
  sync: {
    novelId: "default",
    url: "",
    auth: ""
  },
  assist: {
    languageToolEnabled: false,
    languageToolUrl: "https://api.languagetool.org/v2/check",
    languageToolLanguage: "en-US"
  }
};

let outlineSaveTimer = null;
let openContextMenuAt = null;

// Persist small settings (not content) in localStorage
const SETTINGS_KEY = "novelwriter_settings_v1";
const DAILY_BASELINE_KEY = "novelwriter_daily_baseline_v1";

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (typeof s.autosaveMs === "number") state.autosaveMs = s.autosaveMs;
    if (typeof s.dailyWordGoal === "number") state.dailyWordGoal = s.dailyWordGoal;
    if (typeof s.novelWordGoal === "number") state.novelWordGoal = s.novelWordGoal;
    if (s.sync) state.sync = { ...state.sync, ...s.sync };
    if (s.assist) state.assist = { ...state.assist, ...s.assist };
    if (typeof s.pageView === "boolean") state.pageView = s.pageView;
    if (typeof s.sidebarHidden === "boolean") state.sidebarHidden = s.sidebarHidden;
    if (typeof s.theme === "string") state.theme = s.theme;
  } catch {}
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    autosaveMs: state.autosaveMs,
    dailyWordGoal: state.dailyWordGoal,
    novelWordGoal: state.novelWordGoal,
    sync: state.sync,
    assist: state.assist,
    pageView: state.pageView,
    sidebarHidden: state.sidebarHidden,
    theme: state.theme
  }));
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

let _contentFlushRAF = null;

function flushEditorContent() {
  if (_contentFlushRAF === null) return;
  cancelAnimationFrame(_contentFlushRAF);
  _contentFlushRAF = null;
  const id = state.activeChapterId;
  if (!id || !editor) return;
  const ch = state.chapters.find(c => c.id === id);
  if (!ch) return;
  const jsonDoc = editor.getJSON();
  ch.content = jsonDoc;
  ch.updatedAt = Date.now();
  writeChapterDebounced(id, { content: jsonDoc });
  updateCountsDebounced();
}

function onEditorUpdate() {
  const id = state.activeChapterId;
  if (!id) return;
  if (_contentFlushRAF !== null) cancelAnimationFrame(_contentFlushRAF);
  _contentFlushRAF = requestAnimationFrame(() => {
    _contentFlushRAF = null;
    if (!editor || state.activeChapterId !== id) return;
    const ch = state.chapters.find(c => c.id === id);
    if (!ch) return;
    const jsonDoc = editor.getJSON();
    ch.content = jsonDoc;
    ch.updatedAt = Date.now();
    writeChapterDebounced(id, { content: jsonDoc });
    updateCountsDebounced();
  });
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
      <button class="chapterActionsBtn" type="button" title="Chapter actions" aria-label="Chapter actions">⋯</button>
    `;

    li.addEventListener("click", () => openChapter(ch.id));
    li.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      state.contextChapterId = ch.id;
      openContextMenuAt?.("chapter-context", { x: e.clientX, y: e.clientY });
    });
    bindDragHandlers(li);
    const actionBtn = li.querySelector(".chapterActionsBtn");
    actionBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      state.contextChapterId = ch.id;
      const rect = actionBtn.getBoundingClientRect();
      openContextMenuAt?.("chapter-context", { x: rect.left, y: rect.bottom + 6 });
    });
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

  // Flush pending editor content before switching chapters
  flushEditorContent();
  // Save title of current chapter before switching
  await flushChapterTitle();

  state.activeChapterId = id;
  const ch = state.chapters.find(c => c.id === id);
  $("#chapterTitle").value = ch?.title || "";

  // Load content into editor (isolated per chapter)
  setEditorDoc(editor, ch?.content);
  renderChapters();
  renderOutlinePanel();
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
  _chapterWordCache.clear();
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
  renderOutlinePanel();
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
  populateStatusSelect($("#chapterStatus"));

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

  setupAppWindows();

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

  $("#novelTitle")?.addEventListener("input", debounce(async (e) => {
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

  $("#chapterTitle")?.addEventListener("input", () => autosaveDebounced?.());
  $("#chapterTitle")?.addEventListener("blur", flushChapterTitle);

  $("#chapterSummary")?.addEventListener("input", (e) => {
    const ch = state.chapters.find(c => c.id === state.activeChapterId);
    if (!ch) return;
    ch.summary = e.target.value;
    scheduleOutlineSave(ch);
  });
  $("#chapterPov")?.addEventListener("input", (e) => {
    const ch = state.chapters.find(c => c.id === state.activeChapterId);
    if (!ch) return;
    ch.pov = e.target.value;
    scheduleOutlineSave(ch);
  });
  $("#chapterStatus")?.addEventListener("change", (e) => {
    const ch = state.chapters.find(c => c.id === state.activeChapterId);
    if (!ch) return;
    ch.status = e.target.value;
    scheduleOutlineSave(ch);
  });
  $("#chapterTags")?.addEventListener("input", (e) => {
    const ch = state.chapters.find(c => c.id === state.activeChapterId);
    if (!ch) return;
    ch.tags = e.target.value;
    scheduleOutlineSave(ch);
  });
  $("#chapterWordGoal")?.addEventListener("input", (e) => {
    const ch = state.chapters.find(c => c.id === state.activeChapterId);
    if (!ch) return;
    ch.wordGoal = Number(e.target.value || 0);
    scheduleOutlineSave(ch);
  });
  $("#btnAddScene")?.addEventListener("click", () => {
    const ch = state.chapters.find(c => c.id === state.activeChapterId);
    if (!ch) return;
    ensureChapterOutline(ch);
    const scene = ensureSceneOutline({ title: `Scene ${ch.scenes.length + 1}` }, ch.scenes.length);
    ch.scenes.push(scene);
    scheduleOutlineSave(ch);
    renderSceneList(ch);
  });

  $("#btnNewChapter")?.addEventListener("click", async () => {
    const chap = await createChapter(state.novelId, `Chapter ${state.chapters.length + 1}`);
    state.chapters.push(chap);
    await openChapter(chap.id);
    renderChapters();
    setStatus("Chapter added");
  });

  $("#btnDeleteChapter")?.addEventListener("click", async () => {
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
    else renderOutlinePanel();
    setStatus("Chapter deleted");
  });

  // Backup export/import
  $("#btnBackup")?.addEventListener("click", async () => {
    await flushChapterTitle();
    const includeSnapshots = confirm("Include snapshots in this backup file?");
    const payload = await exportBackup(state.novelId, { includeSnapshots });
    downloadJSON(payload, `${safeFilename(state.novelTitle)}_backup_${nowStamp()}.json`);
  });

  $("#importFile")?.addEventListener("change", async (e) => {
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


  $("#importDocRtf")?.addEventListener("change", async (e) => {
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
  $("#btnExport")?.addEventListener("click", () => safeShowModal(exportModal));

  const getExportData = async () => {
    await flushChapterTitle();
    const includeHeadings = $("#exportIncludeChapterHeadings")?.checked ?? true;
    // refresh chapters from DB to ensure latest order + titles
    const { novel, chapters } = await getNovel(state.novelId);
    return { novelTitle: novel?.title, chapters, includeHeadings };
  };

  $("#exportDocx")?.addEventListener("click", async () => {
    setStatus("Exporting DOCX…");
    const data = await getExportData();
    const mod = await import("./export.js");
    await mod.exportDOCX(data);
    setStatus("Exported DOCX");
  });

  $("#exportPdf")?.addEventListener("click", async () => {
    setStatus("Exporting PDF…");
    const data = await getExportData();
    const mod = await import("./export.js");
    await mod.exportPDF(data);
    setStatus("Exported PDF");
  });

  $("#exportRtf")?.addEventListener("click", async () => {
    setStatus("Exporting RTF…");
    const data = await getExportData();
    const mod = await import("./export.js");
    await mod.exportRTF(data);
    setStatus("Exported RTF");
  });

  // Snapshot modal
  const snapshotModal = $("#snapshotModal");
  $("#btnSnapshotSave")?.addEventListener("click", async () => {
    const chapterId = state.snapshotChapterId || state.activeChapterId;
    if (!chapterId) return;
    await saveSnapshotForChapter(chapterId);
    await renderSnapshotsModal(chapterId);
  });
  snapshotModal?.addEventListener("close", () => {
    state.snapshotChapterId = null;
  });

  // Settings window
  $("#btnSettings")?.addEventListener("click", () => {
    const syncNovelId = $("#syncNovelId");
    const syncUrl = $("#syncUrl");
    const syncAuth = $("#syncAuth");
    const autosaveMs = $("#autosaveMs");
    const dailyWordGoal = $("#dailyWordGoal");
    const novelWordGoal = $("#novelWordGoal");
    const assistEnabled = $("#assistEnabled");
    const assistUrl = $("#assistUrl");
    const assistLanguage = $("#assistLanguage");
    const syncStatus = $("#syncStatus");

    if (syncNovelId) syncNovelId.value = state.sync.novelId || "default";
    if (syncUrl) syncUrl.value = state.sync.url || "";
    if (syncAuth) syncAuth.value = state.sync.auth || "";
    if (autosaveMs) autosaveMs.value = String(state.autosaveMs);
    if (dailyWordGoal) dailyWordGoal.value = String(state.dailyWordGoal || 0);
    if (novelWordGoal) novelWordGoal.value = String(state.novelWordGoal || 0);
    if (assistEnabled) assistEnabled.checked = !!state.assist.languageToolEnabled;
    if (assistUrl) assistUrl.value = state.assist.languageToolUrl || "";
    if (assistLanguage) assistLanguage.value = state.assist.languageToolLanguage || "en-US";
    if (syncStatus) syncStatus.textContent = "";
    toggleWindow("settingsWindow");
  });

  $("#autosaveMs")?.addEventListener("change", (e) => {
    const ms = Math.max(250, Math.min(5000, Number(e.target.value || 800)));
    state.autosaveMs = ms;
    configureAutosave();
    saveSettings();
    setStatus("Settings saved");
  });

  $("#dailyWordGoal")?.addEventListener("change", (e) => {
    state.dailyWordGoal = Math.max(0, Number(e.target.value || 0));
    saveSettings();
    updateCountsDebounced();
    setStatus("Settings saved");
  });

  $("#novelWordGoal")?.addEventListener("change", (e) => {
    state.novelWordGoal = Math.max(0, Number(e.target.value || 0));
    saveSettings();
    updateCountsDebounced();
    setStatus("Settings saved");
  });

  $("#syncNovelId")?.addEventListener("input", debounce((e) => {
    state.sync.novelId = e.target.value.trim();
    saveSettings();
  }, 200));
  $("#syncUrl")?.addEventListener("input", debounce((e) => {
    state.sync.url = e.target.value.trim();
    saveSettings();
  }, 200));
  $("#syncAuth")?.addEventListener("input", debounce((e) => {
    state.sync.auth = e.target.value;
    saveSettings();
  }, 200));

  $("#assistEnabled")?.addEventListener("change", (e) => {
    state.assist.languageToolEnabled = e.target.checked;
    saveSettings();
    setStatus("Settings saved");
  });
  $("#assistUrl")?.addEventListener("input", debounce((e) => {
    state.assist.languageToolUrl = e.target.value.trim();
    saveSettings();
  }, 200));
  $("#assistLanguage")?.addEventListener("input", debounce((e) => {
    state.assist.languageToolLanguage = e.target.value.trim() || "en-US";
    saveSettings();
  }, 200));

  $("#btnSyncNow")?.addEventListener("click", async () => {
    await syncNow({ direction: "push" });
  });

  $("#btnResetApp")?.addEventListener("click", async () => {
    const ok = confirm("Reset ALL local NovelWriter data on this device/browser?");
    if (!ok) return;
    await resetAllData();
    location.reload();
  });

  const analysisModal = $("#analysisModal");
  $("#btnRunAnalysis")?.addEventListener("click", () => refreshAnalysisModal());
  $("#btnRunGrammar")?.addEventListener("click", () => {
    const statusEl = $("#grammarStatus");
    const listEl = $("#grammarResults");
    const text = getActiveChapterText();
    if (statusEl && listEl) {
      runLanguageToolCheck({ text, statusEl, listEl });
    }
  });
  $("#btnOpenAssistSettings")?.addEventListener("click", () => {
    analysisModal?.close();
    $("#btnSettings").click();
  });


  setupMenus();
  setupGlobalShortcuts();

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

function formatSnapshotTimestamp(ts) {
  if (!ts) return "Unknown time";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(t => String(t).trim()).filter(Boolean);
  }
  if (!tags) return [];
  return String(tags)
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function formatTags(tags) {
  return normalizeTags(tags).join(", ");
}

function ensureSceneOutline(scene, index = 0) {
  if (!scene) return null;
  if (!scene.id) scene.id = crypto.randomUUID();
  if (!scene.title) scene.title = `Scene ${index + 1}`;
  scene.summary ??= "";
  scene.pov ??= "";
  scene.status ??= "planned";
  scene.tags = normalizeTags(scene.tags);
  scene.wordGoal = Number.isFinite(scene.wordGoal) ? scene.wordGoal : 0;
  return scene;
}

function ensureChapterOutline(chapter) {
  if (!chapter) return null;
  chapter.summary ??= "";
  chapter.pov ??= "";
  chapter.status ??= "draft";
  chapter.tags = normalizeTags(chapter.tags);
  chapter.wordGoal = Number.isFinite(chapter.wordGoal) ? chapter.wordGoal : 0;
  chapter.scenes = Array.isArray(chapter.scenes) ? chapter.scenes.map(ensureSceneOutline) : [];
  return chapter;
}

function scheduleOutlineSave(chapter) {
  if (!chapter?.id) return;
  if (outlineSaveTimer) clearTimeout(outlineSaveTimer);
  outlineSaveTimer = setTimeout(async () => {
    try {
      await updateChapterMeta(chapter.id, {
        summary: chapter.summary || "",
        pov: chapter.pov || "",
        status: chapter.status || "draft",
        tags: normalizeTags(chapter.tags),
        wordGoal: Number.isFinite(chapter.wordGoal) ? chapter.wordGoal : 0,
        scenes: Array.isArray(chapter.scenes) ? chapter.scenes : []
      });
      setStatus(navigator.onLine ? "Saved (online)" : "Saved (offline)");
    } catch (err) {
      console.warn(err);
      setStatus("Save failed (check storage)");
    }
  }, 300);
}

function setOutlineEnabled(enabled) {
  const fields = [
    "#chapterSummary",
    "#chapterPov",
    "#chapterStatus",
    "#chapterTags",
    "#chapterWordGoal",
    "#btnAddScene"
  ];
  fields.forEach(sel => {
    const el = $(sel);
    if (el) el.disabled = !enabled;
  });
}

function renderOutlinePanel() {
  const chapter = state.chapters.find(c => c.id === state.activeChapterId);
  const summary = $("#chapterSummary");
  const pov = $("#chapterPov");
  const status = $("#chapterStatus");
  const tags = $("#chapterTags");
  const wordGoal = $("#chapterWordGoal");

  if (!chapter) {
    if (summary) summary.value = "";
    if (pov) pov.value = "";
    if (status) status.value = "draft";
    if (tags) tags.value = "";
    if (wordGoal) wordGoal.value = "";
    $("#sceneList") && ($("#sceneList").innerHTML = "");
    setOutlineEnabled(false);
    return;
  }

  ensureChapterOutline(chapter);
  setOutlineEnabled(true);

  if (summary) summary.value = chapter.summary || "";
  if (pov) pov.value = chapter.pov || "";
  if (status) status.value = chapter.status || "draft";
  if (tags) tags.value = formatTags(chapter.tags);
  if (wordGoal) wordGoal.value = chapter.wordGoal ? String(chapter.wordGoal) : "";

  renderSceneList(chapter);
}

function renderSceneList(chapter) {
  const list = $("#sceneList");
  if (!list) return;
  list.innerHTML = "";

  chapter.scenes = Array.isArray(chapter.scenes) ? chapter.scenes.map(ensureSceneOutline) : [];

  if (!chapter.scenes.length) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "No scenes yet. Add one to build your outline.";
    list.appendChild(empty);
    return;
  }

  chapter.scenes.forEach((scene, index) => {
    const card = document.createElement("div");
    card.className = "sceneCard";
    card.dataset.sceneId = scene.id;

    const titleInput = document.createElement("input");
    titleInput.className = "input input--sm sceneTitle";
    titleInput.placeholder = `Scene ${index + 1}`;
    titleInput.value = scene.title || "";

    const badge = document.createElement("span");
    badge.className = "sceneStatusBadge";
    badge.dataset.status = scene.status || "planned";
    badge.textContent = getStatusLabel(scene.status || "planned");

    const header = document.createElement("div");
    header.className = "sceneCard__header";
    header.appendChild(titleInput);
    header.appendChild(badge);

    const summaryLabel = document.createElement("label");
    summaryLabel.className = "field";
    const summarySpan = document.createElement("span");
    summarySpan.textContent = "Summary";
    const summaryInput = document.createElement("textarea");
    summaryInput.className = "input input--area";
    summaryInput.rows = 2;
    summaryInput.value = scene.summary || "";
    summaryLabel.appendChild(summarySpan);
    summaryLabel.appendChild(summaryInput);

    const sceneGrid = document.createElement("div");
    sceneGrid.className = "sceneGrid";

    const povLabel = document.createElement("label");
    povLabel.className = "field";
    const povSpan = document.createElement("span");
    povSpan.textContent = "POV";
    const povInput = document.createElement("input");
    povInput.className = "input input--sm";
    povInput.value = scene.pov || "";
    povLabel.appendChild(povSpan);
    povLabel.appendChild(povInput);

    const statusLabel = document.createElement("label");
    statusLabel.className = "field";
    const statusSpan = document.createElement("span");
    statusSpan.textContent = "Status";
    const statusSelect = document.createElement("select");
    statusSelect.className = "select";
    STATUS_OPTIONS.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      statusSelect.appendChild(option);
    });
    statusSelect.value = scene.status || "planned";
    statusLabel.appendChild(statusSpan);
    statusLabel.appendChild(statusSelect);

    const tagsLabel = document.createElement("label");
    tagsLabel.className = "field";
    const tagsSpan = document.createElement("span");
    tagsSpan.textContent = "Tags";
    const tagsInput = document.createElement("input");
    tagsInput.className = "input input--sm";
    tagsInput.placeholder = "comma, tags";
    tagsInput.value = formatTags(scene.tags);
    tagsLabel.appendChild(tagsSpan);
    tagsLabel.appendChild(tagsInput);

    const wordLabel = document.createElement("label");
    wordLabel.className = "field";
    const wordSpan = document.createElement("span");
    wordSpan.textContent = "Word goal";
    const wordInput = document.createElement("input");
    wordInput.className = "input input--sm";
    wordInput.type = "number";
    wordInput.min = "0";
    wordInput.step = "50";
    wordInput.value = scene.wordGoal ? String(scene.wordGoal) : "";
    wordLabel.appendChild(wordSpan);
    wordLabel.appendChild(wordInput);

    sceneGrid.appendChild(povLabel);
    sceneGrid.appendChild(statusLabel);
    sceneGrid.appendChild(tagsLabel);
    sceneGrid.appendChild(wordLabel);

    const actions = document.createElement("div");
    actions.className = "sceneActions";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn--ghost btn--small";
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    actions.appendChild(deleteBtn);

    const fields = document.createElement("div");
    fields.className = "sceneFields";
    fields.appendChild(summaryLabel);
    fields.appendChild(sceneGrid);
    fields.appendChild(actions);

    card.appendChild(header);
    card.appendChild(fields);

    const updateScene = (patch) => {
      Object.assign(scene, patch);
      if ("status" in patch) {
        badge.dataset.status = scene.status || "planned";
        badge.textContent = getStatusLabel(scene.status || "planned");
      }
      if ("tags" in patch) {
        scene.tags = normalizeTags(scene.tags);
      }
      if ("wordGoal" in patch) {
        scene.wordGoal = Number.isFinite(scene.wordGoal) ? scene.wordGoal : 0;
      }
      scheduleOutlineSave(chapter);
    };

    titleInput.addEventListener("input", (e) => updateScene({ title: e.target.value }));
    summaryInput.addEventListener("input", (e) => updateScene({ summary: e.target.value }));
    povInput.addEventListener("input", (e) => updateScene({ pov: e.target.value }));
    statusSelect.addEventListener("change", (e) => updateScene({ status: e.target.value }));
    tagsInput.addEventListener("input", (e) => updateScene({ tags: e.target.value }));
    wordInput.addEventListener("input", (e) => updateScene({ wordGoal: Number(e.target.value || 0) }));

    deleteBtn.addEventListener("click", () => {
      chapter.scenes = chapter.scenes.filter(s => s.id !== scene.id);
      scheduleOutlineSave(chapter);
      renderSceneList(chapter);
    });

    list.appendChild(card);
  });
}

async function saveSnapshotForChapter(chapterId) {
  if (!chapterId) return;
  if (chapterId === state.activeChapterId) flushEditorContent();
  const chapter = state.chapters.find(c => c.id === chapterId);
  if (!chapter?.content) return;
  const docCopy = JSON.parse(JSON.stringify(chapter.content));
  await createSnapshot(chapterId, docCopy);
  setStatus("Snapshot saved");
}

function updateSnapshotPreview(snapshot) {
  const preview = $("#snapshotPreviewText");
  if (!preview) return;
  if (!snapshot?.doc) {
    preview.textContent = "Select a snapshot to preview.";
    return;
  }
  const text = editorToPlainText(snapshot.doc);
  preview.textContent = text ? text : "(Snapshot is empty.)";
}

async function restoreSnapshot(snapshot) {
  if (!snapshot?.chapterId) return;
  const chapter = state.chapters.find(c => c.id === snapshot.chapterId);
  if (!chapter) return;
  chapter.content = snapshot.doc;
  chapter.updatedAt = Date.now();
  await updateChapterMeta(snapshot.chapterId, { content: snapshot.doc });
  if (state.activeChapterId === snapshot.chapterId) {
    setEditorDoc(editor, snapshot.doc);
  }
  updateCountsDebounced();
  setStatus("Snapshot restored");
}

async function renderSnapshotsModal(chapterId) {
  const list = $("#snapshotList");
  const title = $("#snapshotChapterTitle");
  if (!list) return;
  list.innerHTML = "";
  updateSnapshotPreview(null);

  const chapter = state.chapters.find(c => c.id === chapterId);
  if (title) title.textContent = chapter?.title || "Untitled Chapter";

  const snapshots = await listSnapshotsForChapter(chapterId);
  if (!snapshots.length) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "No snapshots yet. Save one to capture this chapter.";
    list.appendChild(empty);
    return;
  }

  snapshots.forEach(snapshot => {
    const item = document.createElement("div");
    item.className = "snapshotItem";

    const meta = document.createElement("div");
    meta.className = "snapshotMeta";
    const title = document.createElement("div");
    title.className = "snapshotMeta__title";
    title.textContent = formatSnapshotTimestamp(snapshot.createdAt);
    const subtitle = document.createElement("div");
    subtitle.className = "snapshotMeta__subtitle";
    subtitle.textContent = "Snapshot";
    meta.appendChild(title);
    meta.appendChild(subtitle);

    const actions = document.createElement("div");
    actions.className = "snapshotActions";

    const previewBtn = document.createElement("button");
    previewBtn.className = "btn btn--ghost btn--small";
    previewBtn.type = "button";
    previewBtn.textContent = "Preview";

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "btn btn--primary btn--small";
    restoreBtn.type = "button";
    restoreBtn.textContent = "Restore";

    previewBtn.addEventListener("click", () => {
      document.querySelectorAll(".snapshotItem").forEach(el => el.classList.remove("is-selected"));
      item.classList.add("is-selected");
      updateSnapshotPreview(snapshot);
    });

    restoreBtn.addEventListener("click", async () => {
      const ok = confirm("Restore this snapshot? This replaces the current chapter content.");
      if (!ok) return;
      await restoreSnapshot(snapshot);
    });

    actions.appendChild(previewBtn);
    actions.appendChild(restoreBtn);

    item.appendChild(meta);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

async function openSnapshotsModal(chapterId) {
  if (!chapterId) return;
  state.snapshotChapterId = chapterId;
  await renderSnapshotsModal(chapterId);
  safeShowModal("snapshotModal");
}

function isTypingTarget(target) {
  if (!target) return false;
  const el = target.closest?.("input, textarea, select, [contenteditable='true']");
  if (el) return true;
  return !!target.isContentEditable;
}

function setupGlobalShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || e.altKey) return;

    const key = e.key.toLowerCase();
    if (e.shiftKey && key === "n") {
      e.preventDefault();
      $("#btnNewChapter")?.click();
    }
    if (e.shiftKey && key === "e") {
      e.preventDefault();
      $("#btnExport")?.click();
    }
    if (e.shiftKey && key === "b") {
      e.preventDefault();
      $("#btnToggleSidebar")?.click();
    }
    if (e.shiftKey && key === "t") {
      e.preventDefault();
      const title = $("#chapterTitle");
      title?.focus();
      title?.select?.();
    }
  });
}


function setupMenus() {
  const menus = {
    file: $("#menu-file"),
    edit: $("#menu-edit"),
    view: $("#menu-view"),
    insert: $("#menu-insert"),
    format: $("#menu-format"),
    tools: $("#menu-tools"),
    help: $("#menu-help"),
    "chapter-context": $("#menu-chapter-context")
  };
  const menuButtons = Array.from(document.querySelectorAll(".menuBtn"));
  const toolsRoot = document.querySelector(".headerTools");
  const toolsToggle = $("#btnToggleTools");
  let activeMenuButton = null;

  const setMenuButtonExpanded = (btn, isOpen) => {
    if (!btn) return;
    btn.setAttribute("aria-expanded", String(isOpen));
  };

  const setToolsOpen = (isOpen) => {
    if (!toolsRoot || !toolsToggle) return;
    toolsRoot.classList.toggle("is-open", isOpen);
    toolsToggle.setAttribute("aria-expanded", String(isOpen));
    if (!isOpen) closeAllMenus();
    updateHeaderHeight();
  };

  const closeAllMenus = () => {
    menuButtons.forEach(b => {
      b.classList.remove("is-open");
      setMenuButtonExpanded(b, false);
    });
    Object.values(menus).forEach(m => {
      if (!m) return;
      m.classList.remove("is-open");
      // Ensure inline display doesn't keep it visible
      m.style.display = "none";
      const menusRoot = document.querySelector(".menubar");
      if (menusRoot && m.parentElement === document.body) menusRoot.appendChild(m);
    });
    activeMenuButton = null;
  };

  const positionMenu = (menu, left, top) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mrect = menu.getBoundingClientRect();
    let clampedLeft = left;
    let clampedTop = top;
    if (clampedLeft + mrect.width > vw - 8) clampedLeft = vw - mrect.width - 8;
    if (clampedLeft < 8) clampedLeft = 8;
    if (clampedTop + mrect.height > vh - 8) clampedTop = vh - mrect.height - 8;
    if (clampedTop < 8) clampedTop = 8;
    menu.style.left = Math.round(clampedLeft) + "px";
    menu.style.top = Math.round(clampedTop) + "px";
  };

  const getMenuItems = (menu) => Array.from(menu.querySelectorAll(".menuItem")).filter(item => !item.disabled);

  const focusMenuItem = (menu, index) => {
    const items = getMenuItems(menu);
    if (!items.length) return;
    const clampedIndex = (index + items.length) % items.length;
    items[clampedIndex].focus();
  };

  // Position menu under clicked button
  const openMenu = (key, btn) => {
    closeAllMenus();
    const menu = menus[key];
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
    // Default placement: under the menubar button
    let left = rect.left;
    let top = rect.bottom + 6;

    // If there's not enough space below, open upward
    const mrect = menu.getBoundingClientRect();
    if (top + mrect.height > window.innerHeight - 8 && rect.top > mrect.height + 8) {
      top = rect.top - mrect.height - 6;
    }

    positionMenu(menu, left, top);

    btn.classList.add("is-open");
    setMenuButtonExpanded(btn, true);
    activeMenuButton = btn;
    focusMenuItem(menu, 0);
  };

  openContextMenuAt = (key, position) => {
    closeAllMenus();
    const menu = menus[key];
    if (!menu) return;
    menu.style.display = "block";
    menu.classList.add("is-open");
    menu.style.position = "fixed";
    menu.style.zIndex = "10000";
    if (menu.parentElement !== document.body) {
      menu.dataset._home = "1";
      document.body.appendChild(menu);
    }
    positionMenu(menu, position?.x ?? 8, position?.y ?? 8);
  };

  menuButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = btn.dataset.menu;
      const menu = menus[key];
      const isOpen = menu?.classList.contains("is-open");
      if (isOpen) closeAllMenus();
      else openMenu(key, btn);
    });
  });

  toolsToggle?.addEventListener("click", (e) => {
    e.preventDefault();
    setToolsOpen(!toolsRoot?.classList.contains("is-open"));
  });

  document.addEventListener("click", (e) => {
    const inMenu = e.target.closest(".menubar") || e.target.closest(".menu");
    if (!inMenu) closeAllMenus();
    const inTools = e.target.closest(".headerTools") || e.target.closest(".menu");
    if (!inTools) setToolsOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeAllMenus();
    setToolsOpen(false);
  });

  Object.values(menus).forEach(menu => {
    if (!menu) return;
    menu.addEventListener("keydown", (event) => {
      if (!menu.classList.contains("is-open")) return;
      const items = getMenuItems(menu);
      if (!items.length) return;
      const currentIndex = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusMenuItem(menu, currentIndex < 0 ? 0 : currentIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusMenuItem(menu, currentIndex < 0 ? items.length - 1 : currentIndex - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeAllMenus();
        activeMenuButton?.focus();
      }
    });
  });

  // Menu actions
  document.querySelectorAll(".menuItem").forEach(item => {
    item.addEventListener("click", async () => {
      const a = item.dataset.action;
      closeAllMenus();

      switch (a) {
        case "export":
          safeShowModal("exportModal");
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
        case "snapshot-save": {
          const chapterId = state.contextChapterId || state.activeChapterId;
          if (!chapterId) break;
          await saveSnapshotForChapter(chapterId);
          break;
        }
        case "snapshot-restore": {
          const chapterId = state.contextChapterId || state.activeChapterId;
          if (!chapterId) break;
          if (chapterId !== state.activeChapterId) await openChapter(chapterId);
          await openSnapshotsModal(chapterId);
          break;
        }
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
          safeShowModal("wordCountModal");
          break;
        case "writing-analysis":
          openAnalysisModal({ runGrammar: false });
          break;
        case "grammar-check":
          openAnalysisModal({ runGrammar: true });
          break;
        case "about":
          toggleWindow("aboutWindow");
          break;
        default:
          break;
      }
      state.contextChapterId = null;
    });
  });
}

boot().catch((e) => {
  console.error(e);
  setStatus("App error");
  alert("NovelWriter hit an error. Open DevTools Console for details.");
});
