# DraftHarbour Non-Mac Desktop Runtime

This package wraps the Vite frontend in a Tauri shell for Windows and Linux. macOS desktop builds use the native SwiftUI/AppKit app in `../macos`.

## Commands
- `npm run dev` - desktop dev mode (spawns root Vite dev command from tauri config)
- `npm run build` - production bundles for configured Windows/Linux targets
- `npm run build:debug` - debug desktop bundle

## Runtime responsibilities
- Enforce single-instance behavior
- Restore last window position/size
- Process `.dhproj` file open events and `draftharbour://` deep links
- Handle app close with unsaved-edit confirmation semantics

## Packaging targets
See `src-tauri/tauri.conf.json` for Windows/Linux bundle targets and signing env variables. macOS local beta packaging is handled by `../script/package_macos.sh`.
