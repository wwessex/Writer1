# CLAUDE.md - AI Assistant Guide for NovelWriter

## Project Overview

NovelWriter is an **offline-first Progressive Web Application (PWA)** for writing novels. It's a lightweight, browser-based word processor with rich text editing, chapter management, and optional cloud sync.

**Key characteristics:**
- Static site (no backend required for core functionality)
- Vanilla JavaScript with ES modules
- All external dependencies loaded from CDN (esm.sh)
- Service Worker for offline-first PWA experience
- IndexedDB for local data persistence
- ~4,200 lines of focused, readable code

## Architecture

```
NovelWriter/
├── index.html          # Main HTML structure, modals, UI scaffold
├── app.js              # Core application logic, UI state management (~1,740 lines)
├── editor.js           # Tiptap/ProseMirror editor wrapper (~109 lines)
├── storage.js          # IndexedDB operations via Dexie (~229 lines)
├── export.js           # DOCX/PDF/RTF export functionality (~143 lines)
├── importer.js         # DOCX/RTF import with chapter detection (~238 lines)
├── sw.js               # Service Worker for offline caching (~70 lines)
├── styles.css          # Modern UI with dark/light themes (~1,127 lines)
├── manifest.webmanifest # PWA manifest configuration
├── README.md           # User-facing documentation
└── assets/             # PWA icons (192px, 512px)
```

## Technology Stack

| Category | Technology |
|----------|------------|
| Core | Vanilla JavaScript (ES2024+), ES Modules |
| Editor | Tiptap 2.11.5 with ProseMirror |
| Database | Dexie 4.0.8 (IndexedDB wrapper) |
| Export | docx@9.5.0, pdfmake@0.2.10, html-to-rtf@2.2.0 |
| Import | jszip@3.10.1 (DOCX parsing) |
| Writing Analysis | LanguageTool API (optional) |
| Icons | Material Symbols Rounded (Google Fonts) |
| PWA | Service Worker with cache-first strategy |

**All dependencies are loaded from CDN** - no npm/yarn, no build step.

## Key Files and Their Responsibilities

### `app.js` - Main Application
- State management (single `state` object)
- UI event handling and DOM manipulation
- Text analysis (Flesch-Kincaid readability, word counts)
- LanguageTool integration
- Keyboard shortcuts
- Autosave with debouncing
- Online sync functionality

### `editor.js` - Rich Text Editor
- Tiptap/ProseMirror initialization
- Custom keyboard shortcuts extension
- Toolbar binding and active state updates
- JSON-to-plain-text conversion

### `storage.js` - Data Persistence
- Dexie database schema (novels, chapters, snapshots)
- CRUD operations for novels and chapters
- Chapter reordering
- Snapshot (version history) management
- Backup export/import

### `export.js` - Document Export
- DOCX generation with proper structure
- PDF generation with fonts and styling
- RTF conversion via HTML intermediary
- Lazy-loaded dependencies

### `importer.js` - Document Import
- DOCX XML parsing
- RTF parsing with custom lightweight parser
- Smart chapter detection (regex patterns for "Chapter X", "Part X", etc.)
- Automatic chapter splitting

## Data Schema (IndexedDB)

```javascript
// Database: NovelWriterDB
db.version(2).stores({
  novels: "id, title, updatedAt",
  chapters: "id, novelId, order, title, updatedAt",
  snapshots: "id, chapterId, createdAt"
});

// Chapter object structure:
{
  id: string,           // crypto.randomUUID()
  novelId: string,      // Foreign key to novel
  order: number,        // Display order
  title: string,
  updatedAt: number,    // Timestamp
  content: object,      // Tiptap JSON document
  summary: string,
  pov: string,          // Point-of-view character
  status: string,       // "planned" | "draft" | "revised" | "final"
  tags: string[],
  wordGoal: number,
  scenes: string[]
}
```

## Development Workflow

### Running Locally
```bash
# Option A: Python
python3 -m http.server 8080

# Option B: Any static server
npx serve .
```
Open: http://localhost:8080

### Service Worker Bypass
If caching causes issues during development:
```
http://localhost:8080?nosw=1
```
This unregisters the Service Worker and reloads.

### No Build Step
Files are served as-is. Just edit and refresh.

## Code Conventions

### Module Pattern
- ES modules with named exports
- CDN imports from `https://esm.sh/`
```javascript
import Dexie from "https://esm.sh/dexie@4.0.8";
import { Editor } from "https://esm.sh/@tiptap/core@2.11.5";
```

### DOM Utilities
```javascript
const $ = (sel) => document.querySelector(sel);
```

### State Management
Single state object in `app.js`:
```javascript
const state = {
  novelId,
  pageView,           // "chapters" | "outline"
  sidebarHidden,
  theme,              // "dark" | "light"
  novelTitle,
  chapters: [],
  activeChapterId,
  autosaveMs,
  dailyWordGoal,
  novelWordGoal,
  sync: { novelId, url, auth },
  assist: { languageToolEnabled, url, language }
};
```

### Debouncing
Used for autosave and word count updates:
```javascript
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
```

### Event Delegation
Menu actions use `data-action` attributes:
```html
<button data-action="newChapter">New Chapter</button>
```
```javascript
element.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  // Handle action...
});
```

### Defensive Null Checks
Always check elements exist before accessing:
```javascript
const el = document.querySelector(selector);
if (el) {
  el.textContent = value;
}
```

### Modals
Use native `<dialog>` elements:
```javascript
document.getElementById("settingsDialog").showModal();
document.getElementById("settingsDialog").close();
```

## Common Tasks

### Adding a New Feature
1. Identify which file(s) need modification
2. Add UI elements in `index.html` if needed
3. Add styles in `styles.css`
4. Implement logic in `app.js` (or appropriate module)
5. If persisted, update `storage.js` schema/operations

### Adding Storage Fields
1. Update the chapter/novel creation in `storage.js`
2. Add the field to relevant forms in `index.html`
3. Handle persistence in `app.js`

### Adding Export Formats
1. Add lazy-load import in `export.js`
2. Implement conversion function
3. Add UI option in export modal (`index.html`)
4. Wire up in `app.js`

### Keyboard Shortcuts
Global shortcuts in `app.js`:
```javascript
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey && e.key === "B") {
      // Toggle sidebar
    }
  }
});
```

Editor shortcuts in `editor.js` via Tiptap extension:
```javascript
const ShortcutKeymap = Extension.create({
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.commands.toggleBold(),
      // ...
    };
  }
});
```

## Testing and Debugging

### No Automated Tests
This project has no test framework. Test manually in browser.

### Browser DevTools
- **Application tab**: Inspect IndexedDB data, Service Worker status
- **Console**: Check for errors
- **Network tab**: Verify CDN requests

### Clearing Data
- Settings > "Reset All Data" (in app)
- Or clear IndexedDB via DevTools > Application > IndexedDB > Delete database

### Service Worker Issues
1. DevTools > Application > Service Workers > Unregister
2. Or visit with `?nosw=1` query parameter

## Important Patterns

### Lazy Loading
Export libraries are loaded on-demand:
```javascript
const { Document, Packer, Paragraph } = await import("https://esm.sh/docx@9.5.0");
```

### Graceful Degradation
Features work offline; optional features (LanguageTool, sync) fail gracefully.

### LocalStorage vs IndexedDB
- **LocalStorage**: Settings, preferences, theme
- **IndexedDB**: Novel content, chapters, snapshots

### Error Handling
```javascript
try {
  // operation
} catch (err) {
  console.error("Context:", err);
  // Show user-friendly message
}
```

## Git Conventions

### Branch Naming
- Feature branches: `claude/feature-name-sessionId` or `codex/feature-name`
- Always create from main branch

### Commit Messages
- Short, descriptive summary
- Present tense ("Add feature" not "Added feature")
- Reference issue numbers if applicable

### Pull Requests
- Include summary of changes
- Test manually before merging

## External Dependencies (CDN URLs)

```javascript
// Core editor
"https://esm.sh/@tiptap/core@2.11.5"
"https://esm.sh/@tiptap/starter-kit@2.11.5"
"https://esm.sh/@tiptap/extension-underline@2.11.5"
"https://esm.sh/@tiptap/extension-horizontal-rule@2.11.5"

// Database
"https://esm.sh/dexie@4.0.8"

// Export (lazy-loaded)
"https://esm.sh/docx@9.5.0"
"https://esm.sh/pdfmake@0.2.10/build/pdfmake.min.js"
"https://esm.sh/html-to-rtf@2.2.0"

// Import
"https://esm.sh/jszip@3.10.1"
```

## Security Considerations

- All data stored locally by default
- No tracking or analytics
- Optional cloud sync requires user configuration
- Bearer token auth for sync API (if implemented)
- Be cautious with user-provided content in exports

## Quick Reference

| Task | Location |
|------|----------|
| Add UI element | `index.html` |
| Style changes | `styles.css` |
| Editor behavior | `editor.js` |
| Data persistence | `storage.js` |
| Export formats | `export.js` |
| Import formats | `importer.js` |
| Business logic | `app.js` |
| Caching | `sw.js` |
| PWA config | `manifest.webmanifest` |
