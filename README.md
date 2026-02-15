# DraftHarbour Studio (PWA) — Offline/Online Novel Word Processor

A lightweight, installable web app for writing novels:
- Rich text editor (Tiptap/ProseMirror)
- Chapter sidebar (create/rename/delete), **drag to reorder**
- **Chapter-isolated editing** (each chapter is a separate document)
- Autosave to **IndexedDB**
- Optional online sync (simple JSON REST endpoint)
- Export (project-type aware):
  - Novel/manuscript projects: **DOCX**, **PDF**, **RTF**
  - Screenplay projects: **screenplay PDF**, **.fountain**

## Collaboration and cloud features
- **Real-time collaboration:** Invite co-authors with view, comment, or edit permissions.
- **Full version history:** Track revisions with diff previews and restore earlier drafts.
- **Continuous cloud sync:** Automatic syncing across devices with offline editing and eventual synchronization.
- **Comments and inline feedback:** Threaded discussions attached to specific text ranges.

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

## External Integrations

Integration availability is staged and may depend on your project type.

| Integration | Status | Scope |
|---|---|---|
| Scrivener | Planned | Project import/export bridge for manuscript projects |
| Dropbox | Beta | Cloud file sync for backups and shared drafts |
| Google Docs | Available | Document handoff/export for collaborative review workflows |

## Configuration and Security Expectations

### Stored locally (browser)
- Draft content, chapter metadata, and editor state in **IndexedDB**.
- Local app settings (for example export defaults and integration preferences) in browser storage.
- Any local fallback for integration toggles/config (including `IntegrationConfig`) in `localStorage`.

### Server-managed (when configured)
- Synced novel/project payloads sent to your configured sync endpoint.
- Authentication/authorization handling for external providers (tokens should be issued, refreshed, and revoked server-side).
- Access controls, audit logging, and retention policies for cloud-stored content.

### Security guidance
- Treat browser storage as user-device scoped, not a hardened secret vault.
- Do not persist long-lived provider secrets in client storage.
- Prefer short-lived access tokens and server-mediated OAuth flows.
- Always use HTTPS for sync and integration endpoints.

## Migration Note (`IntegrationConfig`)

If `IntegrationConfig` schema fields are added/renamed, existing users with older `localStorage` entries should degrade gracefully:
- Include a schema `version` in stored config.
- On load, merge persisted values over safe defaults and ignore unknown fields.
- If parsing/validation fails, fall back to defaults and keep the app usable offline.
- Apply one-way migration functions (`v1 -> v2 -> ...`) instead of hard-failing older payloads.

## Notes
- External libraries are loaded from CDN ESM endpoints. The Service Worker will cache them after first load.
- If you update files and caching seems stuck, open once with `?nosw=1` to unregister the Service Worker.
