// export.js — DOCX/PDF/RTF exports (client-side)

import { editorToPlainText } from "./editor.js";

// DOCX
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel
} from "https://esm.sh/docx@9.5.0";

// PDF
// pdfmake ESM bundle
import pdfMake from "https://esm.sh/pdfmake@0.2.10/build/pdfmake.js";
import pdfFonts from "https://esm.sh/pdfmake@0.2.10/build/vfs_fonts.js";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

// RTF
import { fromHtml } from "https://esm.sh/html-to-rtf@2.2.0";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function safeFilename(name) {
  return (name || "novel").replace(/[^a-z0-9\-\_\s]/gi, "").trim().replace(/\s+/g, "_").slice(0, 80) || "novel";
}

export async function exportDOCX({ novelTitle, chapters, includeHeadings }) {
  const docChildren = [];

  for (const ch of chapters) {
    if (includeHeadings) {
      docChildren.push(new Paragraph({ text: ch.title || "Untitled Chapter", heading: HeadingLevel.HEADING_1 }));
    }
    // Convert Tiptap JSON → plain text paragraphs (simple but reliable).
    const text = editorToPlainText(ch.content);
    const paras = text.split(/\n\n+/).filter(Boolean);
    for (const p of paras) {
      docChildren.push(new Paragraph({ children: [new TextRun(p)] }));
    }
    docChildren.push(new Paragraph({ text: "" }));
  }

  const doc = new Document({
    creator: "NovelWriter",
    title: novelTitle || "Untitled Novel",
    sections: [{ properties: {}, children: docChildren }]
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeFilename(novelTitle)}.docx`);
}

export async function exportPDF({ novelTitle, chapters, includeHeadings }) {
  const content = [];

  for (const ch of chapters) {
    if (includeHeadings) {
      content.push({ text: ch.title || "Untitled Chapter", style: "h1", margin: [0, 12, 0, 6] });
    }
    const text = editorToPlainText(ch.content);
    const paras = text.split(/\n\n+/).filter(Boolean);
    for (const p of paras) content.push({ text: p, margin: [0, 0, 0, 8] });
    content.push({ text: " ", margin: [0, 0, 0, 8] });
  }

  const docDef = {
    info: { title: novelTitle || "Untitled Novel" },
    content,
    styles: {
      h1: { fontSize: 16, bold: true }
    },
    defaultStyle: {
      fontSize: 11
    },
    pageMargins: [54, 54, 54, 54]
  };

  pdfMake.createPdf(docDef).download(`${safeFilename(novelTitle)}.pdf`);
}

export async function exportRTF({ novelTitle, chapters, includeHeadings }) {
  // RTF via HTML conversion (basic formatting)
  let html = `<h1>${escapeHtml(novelTitle || "Untitled Novel")}</h1>`;
  for (const ch of chapters) {
    if (includeHeadings) html += `<h2>${escapeHtml(ch.title || "Untitled Chapter")}</h2>`;
    html += tiptapJsonToHtml(ch.content);
    html += `<p></p>`;
  }

  const rtf = fromHtml(html);
  const blob = new Blob([rtf], { type: "application/rtf" });
  downloadBlob(blob, `${safeFilename(novelTitle)}.rtf`);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Minimal Tiptap JSON → HTML (keeps basic marks).
function tiptapJsonToHtml(doc) {
  if (!doc) return "<p></p>";
  const renderNode = (node) => {
    if (!node) return "";
    const c = node.content || [];
    const inner = c.map(renderNode).join("");

    switch (node.type) {
      case "doc":
        return inner;
      case "paragraph":
        return `<p>${inner || "&nbsp;"}</p>`;
      case "heading": {
        const level = node.attrs?.level || 1;
        const tag = level === 1 ? "h2" : "h3";
        return `<${tag}>${inner}</${tag}>`;
      }
      case "blockquote":
        return `<blockquote>${inner}</blockquote>`;
      case "bulletList":
        return `<ul>${inner}</ul>`;
      case "orderedList":
        return `<ol>${inner}</ol>`;
      case "listItem":
        return `<li>${inner}</li>`;
      case "text": {
        let out = escapeHtml(node.text || "");
        const marks = node.marks || [];
        for (const m of marks) {
          if (m.type === "bold") out = `<b>${out}</b>`;
          if (m.type === "italic") out = `<i>${out}</i>`;
          if (m.type === "strike") out = `<s>${out}</s>`;
          if (m.type === "code") out = `<code>${out}</code>`;
          if (m.type === "link") {
            const href = escapeHtml(m.attrs?.href || "#");
            out = `<a href="${href}">${out}</a>`;
          }
        }
        return out;
      }
      case "hardBreak":
        return "<br/>";
      default:
        // fallback: render children
        return inner;
    }
  };
  return renderNode(doc);
}
