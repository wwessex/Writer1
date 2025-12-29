# NovelWriter (PWA) — Offline/Online Novel Word Processor

A lightweight, installable web app for writing novels:
- Rich text editor (Tiptap/ProseMirror)
- Chapter sidebar (create/rename/delete), **drag to reorder**
- **Chapter-isolated editing** (each chapter is a separate document)
- Autosave to **IndexedDB**
- Optional online sync (simple JSON REST endpoint)
- Export: **DOCX**, **PDF**, **RTF** (client-side)

## Run
This is a static site. Serve the folder with any static server (recommended for Service Worker):

### Option A: Python
```bash
python3 -m http.server 8080
```
Open: http://localhost:8080

### Option B: VS Code Live Server
Right-click `index.html` → Open with Live Server.

## Install (PWA)
In Chrome/Edge/Safari (iOS): use "Add to Home Screen" / "Install App".

## Data
Saved locally in your browser (IndexedDB). Use **Settings → Export Backup** for a JSON backup.

## Optional Online Sync
Settings → Online Sync:
- Set a `Sync URL` pointing to a simple REST service:
  - `GET  {syncUrl}/novels/{novelId}`  → returns the novel JSON
  - `PUT  {syncUrl}/novels/{novelId}`  with body novel JSON → stores it
- Add an `Authorization` header value (optional).

If no server is configured, the app works fully offline.

## Notes
- External libraries are loaded from CDN ESM endpoints. The Service Worker will cache them after first load.
- If you update files and caching seems stuck, open once with `?nosw=1` to unregister the Service Worker.

