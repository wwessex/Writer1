# Dependency Upgrade Plan (2026-03-22)

## Scope
- Root web app dependencies (`package.json` / `package-lock.json`).
- Desktop shell Node dependencies (`desktop/package.json` / `desktop/package-lock.json`).
- Tauri/Rust dependencies in `desktop/src-tauri/Cargo.toml` were reviewed at a manifest level only (no `cargo outdated` output available in this environment).

## Scan commands run
- `npm outdated --json` (repo root)
- `npm outdated --json` (`desktop/`)
- `cargo outdated --root-deps-only --depth 1 --manifest-path desktop/src-tauri/Cargo.toml` (failed: command not installed)

## Recommended safe upgrades (low risk)
These are patch/minor updates that stay within the current major version and are usually safe with existing APIs.

### Root dependencies/devDependencies
1. Capacitor 8.1.0 → 8.2.0 (aligned family update)
   - `@capacitor/core`
   - `@capacitor/ios`
   - `@capacitor/cli`

2. Tooling patches/minors
   - `@tailwindcss/vite` 4.2.1 → 4.2.2
   - `tailwindcss` 4.2.1 → 4.2.2
   - `@types/react` 19.2.13 → 19.2.14
   - `docx` 9.5.1 → 9.6.1
   - `lint-staged` 16.2.7 → 16.4.0
   - `typescript-eslint` 8.54.0 → 8.57.1
   - `vitest` 4.0.18 → 4.1.0
   - `@vitest/coverage-v8` 4.0.18 → 4.1.0
   - `@eslint/js` 9.39.2 → 9.39.4
   - `eslint` 9.39.2 → 9.39.4

3. Desktop Node toolchain
   - `desktop/@tauri-apps/cli` 2.10.0 → 2.10.1

## Defer for dedicated migration PRs (higher risk)
These involve major-version jumps and should be validated separately with changelog-driven migrations.

- `vite` 6.x → 8.x
- `@vitejs/plugin-react` 4.x → 6.x
- `vite-plugin-pwa` 0.21.x → 1.x
- `typescript` 5.6.x → 5.9.x
- `eslint` 9.x → 10.x
- `eslint-plugin-react-hooks` 5.x → 7.x
- `globals` 15.x → 17.x
- `jsdom` 28.x → 29.x
- `pdfmake` 0.2.x → 0.3.x
- `@types/pdfmake` 0.2.x → 0.3.x

## Suggested execution order
1. Apply all low-risk upgrades in one PR.
2. Run full CI command:
   - `npm run ci`
   - `npm --prefix desktop run build`
3. Cut follow-up PRs by ecosystem:
   - Build chain (Vite + plugin-react + vite-plugin-pwa)
   - Linting stack (ESLint 10 + plugins)
   - Type tooling (TypeScript 5.9)
   - PDF stack (`pdfmake` + `@types/pdfmake`)

## Rust/Tauri note
`cargo outdated` is not available by default in this environment, so a full Rust crate age report could not be produced from tooling output. Before any Tauri dependency bump, run:

```bash
cargo install cargo-outdated
cargo outdated --root-deps-only --depth 1 --manifest-path desktop/src-tauri/Cargo.toml
```

Then prioritize patch/minor updates for crates pinned at major `2` (`tauri*` plugins) to preserve compatibility.
