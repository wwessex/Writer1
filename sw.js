/* NovelWriter Service Worker — offline cache */
const CACHE_NAME = "novelwriter-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./storage.js",
  "./editor.js",
  "./export.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

// External ESM/CDN modules are cached on-demand via runtime caching.

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Bypass on demand
  const url = new URL(req.url);
  if (url.searchParams.get("nosw") === "1") return;

  event.respondWith(
    (async () => {
      // Prefer cache, then network, cache result
      const cached = await caches.match(req, { ignoreSearch: false });
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        // Cache GET only
        if (req.method === "GET") {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (e) {
        // Offline fallback to app shell for navigation requests
        if (req.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        throw e;
      }
    })()
  );
});
