// editor.js — Tiptap editor wrapper
import { Editor } from "https://esm.sh/@tiptap/core@2.11.5";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.11.5";
import Underline from "https://esm.sh/@tiptap/extension-underline@2.11.5";
import HorizontalRule from "https://esm.sh/@tiptap/extension-horizontal-rule@2.11.5";

export function createNovelEditor({ element, onUpdate }) {
  const editor = new Editor({
    element,
    extensions: [StarterKit, Underline, HorizontalRule],
    content: { type: "doc", content: [{ type: "paragraph" }] },
    autofocus: "end",
    editorProps: {
      attributes: { class: "ProseMirror" }
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getJSON());
    }
  });

  return editor;
}

export function setEditorDoc(editor, jsonDoc) {
  editor.commands.setContent(jsonDoc || { type: "doc", content: [{ type: "paragraph" }] }, false);
}

export function bindToolbar(editor, toolbarEl) {
  const q = (cmd) => toolbarEl.querySelector(`[data-cmd="${cmd}"]`);

  const updateActive = () => {
    q("bold")?.classList.toggle("is-active", editor.isActive("bold"));
    q("italic")?.classList.toggle("is-active", editor.isActive("italic"));
    q("strike")?.classList.toggle("is-active", editor.isActive("strike"));
    q("underline")?.classList.toggle("is-active", editor.isActive("underline"));
    q("h1")?.classList.toggle("is-active", editor.isActive("heading", { level: 1 }));
    q("h2")?.classList.toggle("is-active", editor.isActive("heading", { level: 2 }));
    q("ul")?.classList.toggle("is-active", editor.isActive("bulletList"));
    q("ol")?.classList.toggle("is-active", editor.isActive("orderedList"));
    q("quote")?.classList.toggle("is-active", editor.isActive("blockquote"));
  };

  editor.on("selectionUpdate", updateActive);
  editor.on("transaction", updateActive);
  updateActive();

  toolbarEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cmd]");
    if (!btn) return;
    const cmd = btn.dataset.cmd;

    const chain = editor.chain().focus();

    switch (cmd) {
      case "bold": chain.toggleBold().run(); break;
      case "italic": chain.toggleItalic().run(); break;
      case "strike": chain.toggleStrike().run(); break;
      case "underline": chain.toggleUnderline().run(); break;
      case "h1": chain.toggleHeading({ level: 1 }).run(); break;
      case "h2": chain.toggleHeading({ level: 2 }).run(); break;
      case "p": chain.setParagraph().run(); break;
      case "ul": chain.toggleBulletList().run(); break;
      case "ol": chain.toggleOrderedList().run(); break;
      case "quote": chain.toggleBlockquote().run(); break;
      case "hr": chain.setHorizontalRule().run(); break;
      case "undo": editor.commands.undo(); break;
      case "redo": editor.commands.redo(); break;
      default:
        break;
    }
    updateActive();
  });
}

export function editorToPlainText(jsonDoc) {
  // Minimal JSON → text for exports. (Tiptap also provides getText(), but we export without editor instance.)
  const lines = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === "text") {
      lines.push(node.text || "");
      return;
    }
    if (node.type === "paragraph") lines.push("\n");
    if (node.type === "hardBreak") lines.push("\n");
    const content = node.content || [];
    for (const child of content) walk(child);
    if (node.type === "heading" || node.type === "blockquote") lines.push("\n");
    if (node.type === "listItem") lines.push("\n");
  };
  walk(jsonDoc);
  return lines.join("").replace(/\n{3,}/g, "\n\n").trim();
}
