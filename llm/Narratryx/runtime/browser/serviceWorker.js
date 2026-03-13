/* Narratryx model chunk service worker */
const MODEL_CACHE = "narratryx-model-chunks-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes("/models/narratryx/")) return;

  event.respondWith(
    caches.open(MODEL_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const fresh = await fetch(event.request);
      if (fresh.ok) await cache.put(event.request, fresh.clone());
      return fresh;
    })
  );
});
