// importer.js — import DOCX/RTF and split into chapters
// Notes:
// - DOCX parsing uses JSZip (lazy-loaded). First-time DOCX import needs network to fetch JSZip via esm.sh,
//   then it will be cached by the Service Worker for offline use.
// - Formatting is simplified: we import text + headings into Tiptap JSON.
// - Uses a two-pass scoring system for accurate chapter detection:
//   Pass 1: Score each paragraph as a heading candidate (0-100)
//   Pass 2: Apply document-level context to filter false positives

// ---- Pattern definitions ----

const WORD_NUMS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty";
const SEP = "[\\s:\\-\\u2013\\u2014]*"; // optional colon, dash, en-dash, em-dash

const CHAPTER_RE = new RegExp(
  `^(chapter|chap\\.?)\\s+([0-9]+|[ivxlcdm]+|${WORD_NUMS})\\b${SEP}`, "i"
);
const PART_RE = new RegExp(
  `^(part)\\s+([0-9]+|[ivxlcdm]+|${WORD_NUMS})\\b${SEP}`, "i"
);
const BOOK_RE = new RegExp(
  `^(book)\\s+([0-9]+|[ivxlcdm]+|${WORD_NUMS})\\b${SEP}`, "i"
);
const ACT_RE = new RegExp(
  `^(act)\\s+([0-9]+|[ivxlcdm]+|${WORD_NUMS})\\b${SEP}`, "i"
);
const FRONT_RE = /^(prologue|epilogue|preface|foreword|afterword|introduction|author'?s?\s+note|acknowledgm?ents?|dedication|appendix)\b[\s:\-\u2013\u2014]*/i;
const INTERLUDE_RE = /^(interlude|intermezzo|intermission|entr'?acte)\b[\s:\-\u2013\u2014]*/i;

// Standalone number or roman numeral as entire paragraph: "1", "IV", "23."
const STANDALONE_NUM_RE = /^([0-9]+|[IVXLCDM]+)\.?$/;

// Scene breaks — explicitly excluded from heading detection
const SCENE_BREAK_RE = /^(\*\s*\*\s*\*|\*{3,}|-{3,}|~{3,}|#\s*#\s*#|#{3,}|\.{3,}|\u2022\s*\u2022\s*\u2022|[*\-~#.]{1,2}\s+[*\-~#.]{1,2}\s+[*\-~#.]{1,2})$/;

// ---- Utility functions ----

function clean(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

function romanToInt(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const upper = (s || "").toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(upper)) return NaN;
  let total = 0;
  for (let i = 0; i < upper.length; i++) {
    const cur = map[upper[i]] || 0;
    const next = map[upper[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

function isSceneBreak(text) {
  const t = clean(text);
  if (!t) return false;
  return SCENE_BREAK_RE.test(t);
}

function isAllCapsShort(s) {
  const t = clean(s);
  if (!t) return false;
  if (t.length > 44) return false;

  // Reject scene breaks
  if (SCENE_BREAK_RE.test(t)) return false;

  const letters = t.replace(/[^A-Z]/g, "");
  if (letters.length < 6 || t !== t.toUpperCase()) return false;

  // Reject dialogue/exclamations: contains !, ?, or quotation marks
  if (/[!?"'\u201C\u201D\u2018\u2019]/.test(t)) return false;

  // Reject long sentences (>6 words are likely body text, not titles)
  const wordCount = t.split(/\s+/).length;
  if (wordCount > 6) return false;

  return true;
}

// ---- Scoring system ----

function scoreCandidate(text, style) {
  const t = clean(text);
  if (!t) return { score: 0, matchType: null, isSceneBreak: false };
  if (isSceneBreak(t)) return { score: 0, matchType: null, isSceneBreak: true };

  let score = 0;
  let matchType = null;

  // Regex-based detection (high confidence)
  if (CHAPTER_RE.test(t))        { score = 90; matchType = "chapter"; }
  else if (PART_RE.test(t))      { score = 90; matchType = "part"; }
  else if (BOOK_RE.test(t))      { score = 90; matchType = "book"; }
  else if (ACT_RE.test(t))       { score = 90; matchType = "act"; }
  else if (FRONT_RE.test(t))     { score = 85; matchType = "front"; }
  else if (INTERLUDE_RE.test(t)) { score = 85; matchType = "interlude"; }
  else if (STANDALONE_NUM_RE.test(t)) { score = 40; matchType = "standalone_num"; }
  else if (isAllCapsShort(t))    { score = 30; matchType = "allcaps"; }

  // Style bonuses (DOCX only — style is "" for RTF)
  const s = (style || "").toLowerCase();
  if (/heading\s*1/.test(s) || s === "title") {
    score += 30;
    if (!matchType) matchType = "style_only";
  } else if (/heading\s*2/.test(s)) {
    score += 20;
    if (!matchType) matchType = "style_only";
  } else if (/implicit-heading/.test(s)) {
    score += 15;
    if (!matchType) matchType = "style_only";
  }

  // Penalize front/interlude keyword matches that are followed by prose
  // e.g., "Interlude content." is body text, not a heading; but "Interlude: The Dark Hours" is a heading
  if (matchType === "front" || matchType === "interlude") {
    const re = matchType === "interlude" ? INTERLUDE_RE : FRONT_RE;
    const afterKeyword = t.replace(re, "").trim();
    if (afterKeyword && /^[a-z]/.test(afterKeyword) && /[.!?]$/.test(t)) {
      score -= 50; // strong demotion: lowercase continuation + sentence punctuation = prose
    }
  }

  // Length penalty: long text is less likely a heading
  if (t.length > 60 && matchType !== "chapter" && matchType !== "part" && matchType !== "book" && matchType !== "act") {
    score -= 15;
  }

  // Ends with sentence-ending period (not captured by regex patterns above)
  if (/\.\s*$/.test(t) && !CHAPTER_RE.test(t)) {
    score -= 20;
  }

  return { score: Math.max(0, Math.min(100, score)), matchType, isSceneBreak: false };
}

// ---- Context-aware filtering (Pass 2) ----

function filterCandidates(annotated) {
  // Step 1: Count candidate types among high-confidence candidates
  const typeCounts = {};
  for (const p of annotated) {
    if (p.score >= 50 && p.matchType) {
      typeCounts[p.matchType] = (typeCounts[p.matchType] || 0) + 1;
    }
  }

  // Find the dominant type
  let dominantType = null;
  let dominantCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantType = type;
    }
  }
  const hasStrongPattern = dominantCount >= 3;

  // Step 2: Apply contextual rules to each candidate
  for (const p of annotated) {
    if (p.score === 0) continue;

    // Rule A: If a strong dominant pattern exists, suppress low-confidence
    // allcaps and standalone_num candidates that don't reach score 50
    if (hasStrongPattern && (p.matchType === "allcaps" || p.matchType === "standalone_num")) {
      if (p.score < 50) {
        p.isCandidate = false;
        continue;
      }
    }

    // Rule B: standalone_num only survives if the document has at least 3 of them
    // and no other dominant pattern overrides them
    if (p.matchType === "standalone_num" && hasStrongPattern && dominantType !== "standalone_num") {
      p.isCandidate = false;
      continue;
    }

    p.isCandidate = p.score >= 40;
  }

  // Step 3: Spacing-based cluster demotion — two low-confidence candidates
  // within 2 paragraphs of each other are likely emphasis runs, not headings
  let lastCandidateIdx = -10;
  for (let i = 0; i < annotated.length; i++) {
    const p = annotated[i];
    if (!p.isCandidate) continue;

    const gap = i - lastCandidateIdx;
    if (gap <= 2 && p.score < 70 && annotated[lastCandidateIdx]?.score < 70) {
      p.isCandidate = false;
    } else {
      lastCandidateIdx = i;
    }
  }

  // Step 4: Standalone number sequence validation
  // Only keep bare numbers if they form a roughly ascending sequence
  const standaloneNums = annotated.filter(p => p.isCandidate && p.matchType === "standalone_num");
  if (standaloneNums.length > 0) {
    if (standaloneNums.length < 3) {
      // Too few to be confident — demote all
      for (const p of standaloneNums) p.isCandidate = false;
    } else {
      // Validate ascending sequence
      const nums = standaloneNums.map(p => {
        const t = clean(p.text).replace(/\.$/, "");
        const arabic = parseInt(t, 10);
        if (!isNaN(arabic)) return arabic;
        return romanToInt(t);
      });
      let sequential = true;
      for (let i = 1; i < nums.length; i++) {
        if (isNaN(nums[i]) || isNaN(nums[i - 1]) || nums[i] <= nums[i - 1] || nums[i] - nums[i - 1] > 10) {
          sequential = false;
          break;
        }
      }
      if (!sequential) {
        for (const p of standaloneNums) p.isCandidate = false;
      }
    }
  }

  return annotated;
}

// ---- Document conversion helpers ----

function filenameToTitle(name) {
  const base = (name || "Untitled Novel").replace(/\.[^.]+$/, "");
  return clean(base) || "Untitled Novel";
}

function paragraphToTiptap(par) {
  const lines = String(par || "").split("\n");
  const content = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (t) content.push({ type: "text", text: t });
    if (i < lines.length - 1) content.push({ type: "hardBreak" });
  }
  return { type: "paragraph", content: content.length ? content : [{ type: "text", text: "" }] };
}

function textToDoc(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  const content = blocks.length ? blocks.map(paragraphToTiptap) : [{ type: "paragraph" }];
  return { type: "doc", content };
}

// ---- Chapter splitting (two-pass) ----

function splitFromParagraphs(paragraphs, fallbackTitle) {
  const paras = (paragraphs || []).map(p => ({
    text: String(p.text || ""),
    style: p.style || "",
  })).filter(p => clean(p.text).length);

  let novelTitle = fallbackTitle || "Untitled Novel";

  // Novel title detection: first short paragraph in Title/Heading style that is NOT a chapter heading
  if (paras.length) {
    const first = paras[0];
    const t = clean(first.text);
    const s = (first.style || "").toLowerCase();
    if (t && t.length <= 80
        && !CHAPTER_RE.test(t) && !PART_RE.test(t) && !BOOK_RE.test(t)
        && !ACT_RE.test(t) && !FRONT_RE.test(t) && !INTERLUDE_RE.test(t)
        && (s === "title" || /heading\s*1/.test(s))) {
      novelTitle = t;
      paras.shift();
      // Drop immediate empty spacer if present (common on title pages)
      while (paras.length && !clean(paras[0].text)) paras.shift();
    }
  }

  // --- Pass 1: Score all paragraphs ---
  const annotated = paras.map((p, i) => {
    const result = scoreCandidate(p.text, p.style);
    return {
      index: i,
      text: p.text,
      style: p.style,
      isCandidate: result.score >= 40,
      score: result.score,
      matchType: result.matchType,
      isSceneBreak: result.isSceneBreak,
    };
  });

  // --- Pass 2: Context-aware filtering ---
  filterCandidates(annotated);

  // --- Pass 3: Build chapters from filtered candidates ---
  const chapters = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const body = current.body.join("\n\n").trim();
    // Skip empty chapters unless it's the only one (keep at least 1)
    if (!body && chapters.length > 0) return;
    chapters.push({
      title: clean(current.title) || `Chapter ${chapters.length + 1}`,
      doc: textToDoc(body),
    });
  };

  let i = 0;
  while (i < annotated.length) {
    const p = annotated[i];

    // Scene breaks become body text (preserved as ***)
    if (p.isSceneBreak) {
      if (current) current.body.push("***");
      i++;
      continue;
    }

    if (p.isCandidate) {
      pushCurrent();
      current = { title: clean(p.text), body: [] };

      // Subtitle absorption: look ahead for short non-heading, non-punctuated lines
      // that serve as chapter subtitles (e.g., "Chapter 5" followed by "The Long Road")
      const subtitleParts = [];
      let j = i + 1;
      while (j < annotated.length && subtitleParts.length < 2) {
        const next = annotated[j];
        const nt = clean(next.text);
        if (!nt) break;
        if (next.isCandidate || next.isSceneBreak) break;
        if (nt.length > 60 || /[.!?]$/.test(nt)) break;
        subtitleParts.push(nt);
        j++;
      }
      if (subtitleParts.length) {
        current.title = current.title + ": " + subtitleParts.join(" \u2014 ");
        i = j; // skip absorbed lines
      } else {
        i++;
      }
    } else {
      if (!current) current = { title: `Chapter ${chapters.length + 1}`, body: [] };
      current.body.push(p.text);
      i++;
    }
  }
  pushCurrent();

  // Fallback: no headings detected at all — keep as single chapter
  if (!chapters.length) {
    chapters.push({ title: "Chapter 1", doc: textToDoc(paras.map(p => p.text).join("\n\n")) });
  }

  // Clean up titles
  const cleaned = chapters.map((c, idx) => {
    const title = clean(c.title) || `Chapter ${idx + 1}`;
    const doc = c.doc || { type: "doc", content: [{ type: "paragraph" }] };
    return { title, doc };
  });

  return { novelTitle, chapters: cleaned };
}

// ---- RTF parsing ----

function rtfToText(rtf) {
  // Very small RTF -> text converter (good enough for novels)
  // - Converts \par to newlines
  // - Decodes hex \'hh
  // - Strips groups/control words
  let s = String(rtf || "");

  // Remove hidden destination groups like {\*\...}
  s = s.replace(/\{\\\*[^{}]*\}/g, "");

  // Convert paragraph and line breaks
  s = s.replace(/\\par[d]?/g, "\n");
  s = s.replace(/\\line/g, "\n");
  s = s.replace(/\\tab/g, "\t");

  // Decode hex escapes \'hh
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => {
    try { return String.fromCharCode(parseInt(h, 16)); } catch { return ""; }
  });

  // Strip control words (e.g. \fs24, \b0) but keep spaces
  s = s.replace(/\\[a-zA-Z]+\d* ?/g, "");

  // Remove braces
  s = s.replace(/[{}]/g, "");

  // Unescape common sequences
  s = s.replace(/\\~/g, " ");
  s = s.replace(/\\-/g, "-");
  s = s.replace(/\\_/g, "-");
  s = s.replace(/\\\n/g, "\n");

  // Normalise spacing
  s = s.replace(/\u0000/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

async function parseRTF(file) {
  const txt = await file.text();
  const plain = rtfToText(txt);
  const paras = plain.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return paras.map(t => ({ text: t, style: "" }));
}

// ---- DOCX parsing ----

async function parseDOCX(file) {
  const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) throw new Error("DOCX missing word/document.xml");

  const parser = new DOMParser();
  const xml = parser.parseFromString(docXml, "application/xml");

  const ps = Array.from(xml.getElementsByTagName("w:p"));
  const paragraphs = [];

  const getStyle = (p) => {
    const pPr = p.getElementsByTagName("w:pPr")[0];
    if (!pPr) return "";
    const pStyle = pPr.getElementsByTagName("w:pStyle")[0];
    let val = pStyle?.getAttribute("w:val") || pStyle?.getAttribute("val") || "";

    // Check for centering (common for chapter headings)
    const jc = pPr.getElementsByTagName("w:jc")[0];
    const alignment = jc?.getAttribute("w:val") || "";

    // Check for paragraph-level bold via run properties
    const rPr = pPr.getElementsByTagName("w:rPr")[0];
    const hasBold = rPr?.getElementsByTagName("w:b")[0] !== undefined;

    // Check for large font size (w:sz value is in half-points, 28 = 14pt)
    const sz = rPr?.getElementsByTagName("w:sz")[0];
    const fontSize = parseInt(sz?.getAttribute("w:val") || "0", 10);
    const isLargeFont = fontSize >= 28;

    // If no named style but has bold + centered (with or without large font), treat as implicit heading
    if (!val && hasBold && alignment === "center") {
      val = "implicit-heading";
    } else if (!val && isLargeFont && alignment === "center") {
      val = "implicit-heading";
    }

    return val || "";
  };

  const paragraphText = (p) => {
    const out = [];
    const walk = (node) => {
      for (const child of Array.from(node.childNodes || [])) {
        if (child.nodeType !== 1) continue; // elements only
        const tag = child.tagName;
        if (tag === "w:t") out.push(child.textContent || "");
        else if (tag === "w:tab") out.push("\t");
        else if (tag === "w:br") out.push("\n");
        walk(child);
      }
    };
    walk(p);
    return out.join("").replace(/\s+\n/g, "\n").trim();
  };

  for (const p of ps) {
    const style = getStyle(p);
    const text = paragraphText(p);
    if (!clean(text)) continue;
    // Map style ids to friendly names (enough for our heuristics)
    let styleName = style;
    if (/heading1/i.test(style)) styleName = "Heading 1";
    if (/heading2/i.test(style)) styleName = "Heading 2";
    if (/title/i.test(style)) styleName = "Title";
    paragraphs.push({ text, style: styleName });
  }

  return paragraphs;
}

// ---- Public API ----

export async function parseImportFile(file) {
  if (!file) throw new Error("No file selected");
  const name = file.name || "Imported";
  const fallbackTitle = filenameToTitle(name);

  const ext = (name.split(".").pop() || "").toLowerCase();
  let paragraphs = [];
  if (ext === "rtf" || file.type.includes("rtf")) {
    paragraphs = await parseRTF(file);
  } else if (ext === "docx" || file.type.includes("officedocument")) {
    paragraphs = await parseDOCX(file);
  } else {
    throw new Error("Unsupported file type. Please use .docx or .rtf");
  }

  return splitFromParagraphs(paragraphs, fallbackTitle);
}
