// importer.js — import DOCX/RTF and split into chapters
// Notes:
// - DOCX parsing uses JSZip (lazy-loaded). First-time DOCX import needs network to fetch JSZip via esm.sh,
//   then it will be cached by the Service Worker for offline use.
// - Formatting is simplified: we import text + headings into Tiptap JSON.

const CHAPTER_RE = /^(chapter|chap\.?)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b[\s:\-–—]*/i;
const PART_RE = /^(part)\s+([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b[\s:\-–—]*/i;
const FRONT_RE = /^(prologue|epilogue|preface|foreword|afterword)\b[\s:\-–—]*/i;

function clean(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}
function isAllCapsShort(s) {
  const t = clean(s);
  if (!t) return false;
  if (t.length > 44) return false;
  // allow numbers/roman numerals
  const letters = t.replace(/[^A-Z]/g, "");
  return letters.length >= 6 && t === t.toUpperCase();
}
function isHeadingLike(text, style = "") {
  const t = clean(text);
  if (!t) return false;
  const s = (style || "").toLowerCase();
  // Word heading styles: Heading1, Heading2, heading 1, etc
  const isStyleHeading = /heading\s*([12])/.test(s) || s === "title";
  return isStyleHeading || CHAPTER_RE.test(t) || PART_RE.test(t) || FRONT_RE.test(t) || isAllCapsShort(t);
}

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

function splitFromParagraphs(paragraphs, fallbackTitle) {
  const paras = (paragraphs || []).map(p => ({
    text: String(p.text || ""),
    style: p.style || "",
  })).filter(p => clean(p.text).length);

  let novelTitle = fallbackTitle || "Untitled Novel";

  // Title detection: first short paragraph in Title/Heading style and NOT chapter-like
  if (paras.length) {
    const first = paras[0];
    const t = clean(first.text);
    if (t && t.length <= 80 && !CHAPTER_RE.test(t) && !PART_RE.test(t) && !FRONT_RE.test(t) &&
        (String(first.style || "").toLowerCase() === "title" || /heading\s*1/.test(String(first.style || "").toLowerCase()))) {
      novelTitle = t;
      paras.shift();
      // Also drop an immediate empty spacer if present (sometimes title page)
      while (paras.length && !clean(paras[0].text)) paras.shift();
    }
  }

  const chapters = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    const body = current.body.join("\n\n").trim();
    chapters.push({
      title: clean(current.title) || `Chapter ${chapters.length + 1}`,
      doc: textToDoc(body)
    });
  };

  for (const p of paras) {
    const t = p.text;
    if (isHeadingLike(t, p.style)) {
      // start a new chapter
      pushCurrent();
      current = { title: t, body: [] };
    } else {
      if (!current) current = { title: `Chapter ${chapters.length + 1}`, body: [] };

      // Smart subtitle: if we just started a chapter like "Chapter 3" and the next short line
      // looks like a section title, treat it as part of the chapter title.
      const curT = clean(current.title);
      const nextT = clean(t);
      if (current.body.length === 0 && nextT.length && nextT.length <= 60 && !/[.!?]$/.test(nextT) &&
          (CHAPTER_RE.test(curT) || PART_RE.test(curT) || FRONT_RE.test(curT))) {
        current.title = curT + ": " + nextT;
      } else {
        current.body.push(t);
      }
    }
  }
  pushCurrent();

  // If we didn't detect any headings, keep as single chapter
  if (!chapters.length) {
    chapters.push({ title: "Chapter 1", doc: textToDoc(paras.map(p => p.text).join("\n\n")) });
  }

  // Clean up empty docs
  const cleaned = chapters.map((c, i) => {
    const title = clean(c.title) || `Chapter ${i + 1}`;
    const doc = c.doc || { type: "doc", content: [{ type: "paragraph" }] };
    return { title, doc };
  });

  return { novelTitle, chapters: cleaned };
}

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
    const val = pStyle?.getAttribute("w:val") || pStyle?.getAttribute("val") || "";
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

async function parseRTF(file) {
  const txt = await file.text();
  const plain = rtfToText(txt);
  const paras = plain.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return paras.map(t => ({ text: t, style: "" }));
}

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
