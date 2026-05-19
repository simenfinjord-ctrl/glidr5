const CACHE_NAME = "glidr-v4";
const STATIC_EXTENSIONS = [".js", ".css", ".png", ".jpg", ".svg", ".ico", ".woff", ".woff2"];
const API_CACHE_NAME = "glidr-api-v4";
// API routes to cache for offline reading
const CACHEABLE_API = ["/api/tests", "/api/products", "/api/groups", "/api/users", "/api/weather", "/api/testskis"];

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

  // API caching: network-first, fall back to cache for important endpoints
  if (url.pathname.startsWith("/api/")) {
    const isCacheable = CACHEABLE_API.some((p) => url.pathname.startsWith(p));
    if (!isCacheable) return;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request, { cacheName: API_CACHE_NAME })
          .then((cached) => cached || new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" }, status: 200 }))
        )
    );
    return;
  }

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
  } else {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")).then((r) => r || new Response("Offline", { status: 503 })))
    );
  }
});
