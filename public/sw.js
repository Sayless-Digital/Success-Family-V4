// Service Worker for Success Family Platform
// Version: 1762798701807

const CACHE_NAME = 'success-family-v1';
const RUNTIME_CACHE = 'runtime-cache-v1';

// Don't cache these paths
const EXCLUDED_PATHS = [
  '/api/',
  'https://tfpmnzyxqprqqjuwydcr.supabase.co/',
];

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version:', CACHE_NAME);
  self.skipWaiting();
});

// Activate event - clean old caches and take control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version:', CACHE_NAME);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - network first strategy for API calls, cache for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip caching for excluded paths (API calls, Supabase)
  const shouldSkipCache = EXCLUDED_PATHS.some(path => request.url.includes(path));
  
  if (shouldSkipCache || request.method !== 'GET') {
    // For API calls and non-GET requests, always go to network
    event.respondWith(fetch(request));
    return;
  }

  // For static assets, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Don't cache if not successful
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});