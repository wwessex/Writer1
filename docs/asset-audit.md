# Asset Audit

## Canonical source decision

- **Canonical icon source:** `public/assets`
- **Rationale:** PWA manifest entries (`vite.config.ts`) and HTML icon links (`index.html`) already reference `/assets/*`, and runtime UI icon usage in `Header.tsx` resolves to `${BASE_URL}assets/*`.

## Asset map

### PWA manifest + includeAssets (`vite.config.ts`)

- `includeAssets`
  - `assets/favicon.ico`
  - `assets/apple-touch-icon.png`
  - `assets/*.png`
  - `assets/*.svg`
  - `brand/*.svg`
- `manifest.icons`
  - `assets/icon-blue-32.png` (32x32)
  - `assets/icon-blue-48.png` (48x48)
  - `assets/icon-blue-192.png` (192x192)
  - `assets/icon-blue-512.png` (512x512)
  - `assets/pwa-192.png` (192x192, maskable)
  - `assets/pwa-512.png` (512x512, maskable)

### HTML entrypoint (`index.html`)

- `/assets/favicon.ico`
- `/assets/icon-blue-48.png`
- `/assets/icon-blue-192.png`
- `/assets/apple-touch-icon.png`

### Runtime imports/references in code

- `src/components/Header/Header.tsx`
  - `${import.meta.env.BASE_URL}assets/icon-black-64.png`
  - `${import.meta.env.BASE_URL}assets/icon-blue-64.png`
- `src/components/Windows/AboutWindow.tsx`
  - `${import.meta.env.BASE_URL}brand/logo.svg`
  - `${import.meta.env.BASE_URL}brand/logo-light.svg`

## Cleanup performed

- Removed duplicate icon set previously mirrored under `src/assets`.
- Retained canonical assets in `public/assets`.
