// FoodEnvy service worker -- installability + offline support.
//
// Two deliberately different caching strategies for two different kinds of asset:
//   - App shell (index.html, favicon, manifest, icons): cache-first, versioned. These only
//     change on a deploy, so instant-from-cache is correct and CACHE_VERSION below is bumped
//     by hand whenever a deploy changes the shell -- explicit, not auto-detected, matching this
//     codebase's "make it explicit, don't guess" convention elsewhere.
//   - Recipe data (foodenvy-complete-recipes.json): network-first, falling back to cache only
//     when the network request itself fails. Recipe data (allergen tags, servings, corrections)
//     changes independently of the app shell and a connected family deserves the live file --
//     the cache exists purely as an offline fallback, never the default.
//
// The cached recipe-data response is stamped with the time it was fetched (X-FoodEnvy-Cached-At)
// so that if it's ever served as a fallback, the client can show a real "viewing offline data
// from {date}" notice on the allergen chip surface rather than a silent, indistinguishable swap
// from live to stale data -- required by the allergy-safety review of this feature.

const CACHE_VERSION = 'v1';
const SHELL_CACHE = 'foodenvy-shell-' + CACHE_VERSION;
const DATA_CACHE = 'foodenvy-data';

const SHELL_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-apple-touch-180.png'
];

const RECIPE_DATA_PATTERN = /foodenvy-complete-recipes\.json$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('foodenvy-shell-') && key !== SHELL_CACHE)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Only skips the waiting phase when the user explicitly taps "Refresh" on the update toast
// (index.html) -- never automatically, so an in-progress session is never silently swapped out
// from under someone.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (RECIPE_DATA_PATTERN.test(url.pathname)) {
    event.respondWith(handleRecipeDataFetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

async function handleRecipeDataFetch(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const body = await networkResponse.clone().blob();
      const stamped = new Response(body, {
        headers: {
          'Content-Type': networkResponse.headers.get('Content-Type') || 'application/json',
          'X-FoodEnvy-Cached-At': new Date().toISOString()
        }
      });
      cache.put(request, stamped);
      return networkResponse;
    }
    throw new Error('Network response not OK: ' + networkResponse.status);
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}
