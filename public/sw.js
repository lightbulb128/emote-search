// Service worker for EmoteLab PWA
// Caches essential assets for offline use and fast loading

const CACHE_NAME = "emotelab-v1";
const BASE_PATH = "/emotelab-query";

const PRECACHE_URLS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/favicon.svg`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`,
];

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Non-critical — core assets may fail, site still works
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache GIFs and page assets on the fly
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only cache same-origin requests
  if (url.origin !== self.location.origin) return;

  // Cache GIF files aggressively (they're static)
  if (url.pathname.endsWith(".gif")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Cache other static assets (JS, CSS, fonts, images)
  if (
    url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/) ||
    url.pathname.startsWith(`${BASE_PATH}/assets/`)
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // For HTML pages, use network-first strategy
  if (event.request.destination === "document") {
    event.respondWith(networkFirst(event.request));
    return;
  }
});

// Cache-first strategy: serve from cache, update cache in background
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached — return a graceful empty response
    return new Response(null, { status: 408 });
  }
}

// Network-first strategy: try network, fall back to cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(null, { status: 408 });
  }
}
