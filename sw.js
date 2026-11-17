// SafeTradie offline support.
// The page is fetched fresh when there's signal (so updates show straight away)
// and served from the phone's cache when there isn't.
const CACHE = "safetradie-v1";
const JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const CORE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    try { await c.add(new Request(JSPDF, { mode: "cors" })); } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;               // sending emails always goes to the network
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;

  // The page itself: network first, cached copy when offline
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put("/", fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  // PDF library, icons, manifest: cache first
  if (url.href === JSPDF || url.origin === self.location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});
