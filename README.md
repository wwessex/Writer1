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


## iOS Native App (Capacitor)

This project now includes Capacitor configuration so the web app can run as a native iOS app.

### Prerequisites
- macOS with Xcode installed
- CocoaPods (`sudo gem install cocoapods` if needed)

### Build and sync web assets to native projects
```bash
npm run build:native
```

### Open in Xcode
```bash
npm run cap:open:ios
```

From Xcode, select a simulator/device and run the app.

### Daily workflow
After web code changes, re-run:
```bash
npm run build:native
```

### Capacitor health check
If native tooling seems out of sync, run:
```bash
npm run cap:doctor
```

### About iOS icon/splash image files in git
To keep PR tooling compatible in environments that reject binary files, the repo tracks only the asset catalog metadata (`Contents.json`) for iOS app icons/splash.

After opening in Xcode, add your final icon/splash images in:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- `ios/App/App/Assets.xcassets/Splash.imageset/`

### If GitHub mobile shows “Error creating pull request (400)”
That error is usually a GitHub client/API issue (not a Capacitor project issue). Workarounds:
- Refresh and retry after pushing the branch again.
- Create the PR from github.com in a desktop/mobile browser instead of the GitHub mobile app.
- Use GitHub CLI: `gh pr create --fill`.

## Data
Saved locally in your browser (IndexedDB). Use **Settings → Export Backup** for a JSON backup.

## Optional Online Sync
Settings → Online Sync:
- Set a `Sync URL` pointing to a simple REST service:
  - `GET  {syncUrl}/novels/{novelId}`  → returns the novel JSON
  - `PUT  {syncUrl}/novels/{novelId}`  with body novel JSON → stores it
- Add an `Authorization` header value (optional).

If no server is configured, the app works fully offline.

## AI Setup (Server Proxy + Local Broker)

The AI features can run through either:
- `api/` (PHP server proxy for production-style deployments), or
- the local dev broker in `src/server/integrationBroker.ts`.

### 1) Configure `api/_config.php` provider keys

Edit `api/_config.php` and set the provider keys you plan to use:

- `groq.api_key`
- `openrouter.api_key`
- `gemini.api_key`

Each provider also has an `enabled` flag. If `enabled` is `false`, requests for that provider are rejected.

### 2) Understand `allow_byok`

`allow_byok` controls whether the client can submit `userApiKey` in the `/api/chat` request body:

- `true`: request-level key override is allowed (Bring Your Own Key)
- `false`: only server-side keys from `api/_config.php` are accepted

For shared/public deployments, `false` is generally safer.

### 3) Deploy `api/` behind PHP for `/api/chat`

`/api/chat` is a server endpoint, not a static file route. To use the PHP proxy path, deploy the `api/` directory behind a PHP-enabled web server (Apache, Nginx+PHP-FPM, etc.) so requests to `/api/chat` are executed server-side.

If you only serve static frontend files, `/api/chat` will not work.

### 4) Local dev broker env vars (`src/server/integrationBroker.ts`)

For local/server runtime (Node), set these environment variables as needed:

- `BROKER_GROQ_API_KEY`
- `BROKER_OPENROUTER_API_KEY`
- `BROKER_GEMINI_API_KEY`
- `BROKER_OPENAI_API_KEY`

`BROKER_OPENAI_API_KEY` is used by `/api/ai/generate` in the broker implementation.

See `.env.example` for a complete list of frontend and broker/server environment variables.

## AI runtime modes

The app supports two backend runtime paths for AI, depending on how you host and configure it.

### 1) Dev mode: Vite middleware + Node broker

In local dev, Vite can hand off AI requests to the broker handler in `src/server/integrationBroker.ts`:

- `POST /api/ai/generate` → handled by `generateAI(...)` (OpenAI-compatible path using `BROKER_OPENAI_API_KEY` / `OPENAI_API_KEY`)
- `POST /api/chat` → handled by `generateServerProxy(...)` (Groq / OpenRouter / Gemini proxy path)

The route dispatch happens in `handleBrokerRequest(...)`, which matches those exact paths.

### 2) Hosted mode: PHP API

In hosted deployments, the frontend calls into `api/index.php`, which routes `POST /api/chat` to `api/_chatHandler.php`.

- `api/index.php` performs CORS + rate-limit checks, then routes `/api/chat`
- `api/_chatHandler.php` validates payload fields (`provider`, `prompt`, `model`), enforces limits, resolves API keys (server key or BYOK), and forwards to the selected provider

## Frontend → backend wiring (`VITE_BROKER_BASE_URL`)

`src/lib/featureFlags.ts` exposes:

```ts
export function getBrokerBaseUrl(): string {
  return import.meta.env.VITE_BROKER_BASE_URL || '';
}
```

Frontend providers build API URLs from this value:

- Cloud/OpenAI path: `${getBrokerBaseUrl()}/api/ai/generate`
- Server-proxy path: `${getBrokerBaseUrl()}/api/chat`

Example `.env` values:

```bash
# Local Vite+broker runtime
VITE_BROKER_BASE_URL=http://localhost:5173

# Hosted PHP API on same origin (optional; empty uses relative URLs)
VITE_BROKER_BASE_URL=

# Hosted API on another origin
VITE_BROKER_BASE_URL=https://your-domain.example
```

## What happens when no broker URL is configured

Because `getBrokerBaseUrl()` falls back to `''`, requests become relative paths:

- `/api/ai/generate`
- `/api/chat`

So behavior depends on your host:

- If your server exposes those endpoints on the same origin, calls still work.
- If not, requests return 404/network errors.
- In managed-cloud mode, the OpenAI provider explicitly throws a user-facing error when no broker URL is available, prompting users to configure a custom provider or supported on-device option.

## Verify endpoint readiness before enabling AI features

Run these checks first (replace base URL as needed):

```bash
# 1) Basic route check (expect JSON 404 on GET from PHP router, which proves routing is alive)
curl -i https://your-domain.example/api/chat

# 2) CORS/preflight check for browser POSTs
curl -i -X OPTIONS https://your-domain.example/api/chat

# 3) Functional POST check (expect 200 or a structured JSON error, not HTML)
curl -i -X POST https://your-domain.example/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"provider":"groq","model":"llama-3.3-70b-versatile","prompt":"ping"}'
```

For dev broker mode, run the same checks against your local Vite URL (for example `http://localhost:5173/api/chat` and `http://localhost:5173/api/ai/generate`). Do this before turning on AI in user-facing environments so failures surface early.

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
