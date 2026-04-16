# DraftHarbour Desktop Runtime

This package wraps the Vite frontend in a Tauri shell.

## Commands
- `npm run dev` - desktop dev mode (spawns root Vite dev command from tauri config)
- `npm run build` - production bundles for configured targets
- `npm run build:debug` - debug desktop bundle
- `npm run build:mac` - macOS universal build with native titlebar treatment
- `npm run build:mac:debug` - debug macOS universal build

## Runtime responsibilities
- Enforce single-instance behavior
- Restore last window position/size
- Process `.dhproj` file open events and `draftharbour://` deep links
- Handle app close with unsaved-edit confirmation semantics

## Packaging targets
See `src-tauri/tauri.conf.json` for bundle targets and signing/notarization env variables.

## macOS polish
- Uses an overlay title bar + transparent window treatment for a liquid-glass shell.
- Frontend applies macOS-only glass chrome styles when running in the Tauri runtime.
