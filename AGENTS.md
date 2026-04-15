# AGENTS.md — DraftHarbour Studio

## Overview

DraftHarbour Studio is an offline-first writing app built with React 19, TypeScript, and Vite. The repo also ships a Tauri desktop app under `desktop/` and a Capacitor iOS wrapper under `ios/`.

## Core workflows

- Install dependencies with `npm ci`.
- Start web development with `npm run dev`.
- Build the web app with `npm run build`.
- Preview the production web build with `npm run preview`.
- Run the fast validation loop with `npm run lint` and `npm run typecheck`.
- Run tests with `npm run test` or `npm run test:coverage`.
- Run the full repo validation with `npm run ci`.

## Repo-specific checks

- Verify Vite config loads in CI-like conditions with `npm run verify:vite-config`.
- Check changed-file coverage gates with `npm run coverage:changed`.
- Check bundle size budgets with `npm run bundle:check`.
- Check duplicate asset payloads with `npm run assets:check`.
- Review available test coverage inventory with `npm run test:inventory`.

## Native workflows

- Sync web assets into native projects with `npm run build:native`.
- Re-sync Capacitor without rebuilding via `npm run cap:sync`.
- Open the iOS project in Xcode with `npm run cap:open:ios`.
- Check Capacitor environment health with `npm run cap:doctor`.
- Start the Tauri desktop shell with `npm run desktop:dev`.
- Build desktop artifacts with `npm run desktop:build`.
- Build debug desktop artifacts with `npm run desktop:build:debug`.

## CI notes

- PR checks run `npm run lint`, `npm run assets:check`, `npm run typecheck`, `npm run verify:vite-config`, `npm run test:coverage`, `npm run coverage:changed`, `npm run build`, and `npm run bundle:check`.
- GitHub Pages and static-site packaging workflows install with `npm ci` and build with `npm run build`.
