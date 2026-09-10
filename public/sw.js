// Minimal installable-PWA service worker.
//
// Deliberately conservative: it caches the app shell for offline launch and
// gets out of the way for everything else. Ticket, listing, and price data must
// never be served stale from a cache — a stale price is a compliance problem,
// not just a UX one — so only same-origin static assets are cached.
const CACHE = "passe-shell-v2";
const SHELL = ["/manifest.webmanifest", "/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  const isStatic = url.pathname.startsWith("/flyers/") || SHELL.includes(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.match(event.request).then((hit) => hit ?? fetch(event.request)),
  );
});
