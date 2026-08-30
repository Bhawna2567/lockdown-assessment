// ClassCurio service worker. Minimal: enables PWA installability and a
// stale-while-revalidate cache for static assets so the app icon shows up
// after install and the first paint is fast offline-or-online.
//
// Important: We deliberately DO NOT cache HTML or JS deeply. Assessment
// content, results, and proctoring traffic must always go to the network so
// teachers see live data and live grading runs.

const CACHE = 'classcurio-v2';
const STATIC = [
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/css/styles.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // NAVIGATION requests — network-first with cached fallback. Required for
  // Chrome to mark the PWA as installable (Chrome wants a fetch handler
  // that produces a Response for the start_url).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        try {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        } catch {}
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
    );
    return;
  }

  // STATIC assets — cache-first then network update.
  const isStatic =
    /\.(png|svg|css|js|woff2?|ttf|otf|ico|webp|jpg|jpeg)$/i.test(url.pathname) ||
    url.pathname === '/manifest.json';
  if (!isStatic) return;
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || fetchPromise;
    })
  );
});
