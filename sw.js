const CACHE = "commoncents-shell-8da5e7c12504";
const PREFIX = "commoncents-shell-";
const SHELL = ["./index.html","./archive.css","./legacy.html","./manifest.webmanifest","./pwa.js","./pwa.css","./icons/icon-192.png","./icons/icon-512.png","./icons/apple-touch-icon.png","./icons/maskable-512.png","./minimal.css","./landing.css","./assets/wealth-bg-dark.png","./assets/wealth-bg-light.png","./assets/wealth-visual-atlas.png","./assets/wealth-snapshot-tiles.png","./assets/emergency-cash-mascots.png","./assets/protection-sprites.png","./assets/insurance-shield.png"];
const allowed = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(path => new Request(new URL(path, self.registration.scope).href, { cache: "reload" }))))));
self.addEventListener("activate", event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener("message", event => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const canonical = new URL(url.pathname, url.origin).href;
  if (event.request.mode !== "navigate" && !allowed.has(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = event.request.mode === "navigate" ? new URL(url.pathname.endsWith('/legacy.html') ? 'legacy.html' : 'index.html', self.registration.scope).href : canonical;
    // Keep HTML and scripts from the same release until the user accepts an update.
    const cached = await cache.match(key);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === "basic") await cache.put(key, response.clone());
      return response;
    } catch {
      return (await cache.match(key)) || Response.error();
    }
  })());
});
