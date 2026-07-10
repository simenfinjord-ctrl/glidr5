const CACHE_NAME = "glidr-v8";
const STATIC_EXTENSIONS = [".js", ".css", ".png", ".jpg", ".svg", ".ico", ".woff", ".woff2"];
const API_CACHE_NAME = "glidr-api-v8";
// Endpoints that always need a live server and must never be served from cache.
const NEVER_CACHE_API = ["/api/auth/login", "/api/auth/logout", "/api/watch/", "/api/admin/active-sessions"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Navigation requests (HTML pages) — serve app shell, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then((cached) => cached || caches.match("/"))
            .then((r) => r || new Response("Offline", { status: 503 }))
        )
    );
    return;
  }

  // API caching: network-first for ALL GET endpoints, fall back to the cached
  // copy when offline so every page can show its last-known data. A cache miss
  // returns 503 so the app's IndexedDB layer (getQueryFn) can try as a 2nd layer.
  if (url.pathname.startsWith("/api/")) {
    const neverCache = NEVER_CACHE_API.some((p) => url.pathname.startsWith(p));
    if (neverCache) return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request, { cacheName: API_CACHE_NAME })
            .then((cached) => cached || new Response(JSON.stringify({ offline: true }), { headers: { "Content-Type": "application/json" }, status: 503 }))
        )
    );
    return;
  }

  // Static assets: cache-first
  const isStaticAsset = STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request)
          .then((cached) => cached || caches.match("/"))
          .then((r) => r || new Response("Offline", { status: 503 }))
      )
  );
});
