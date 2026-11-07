const CACHE_NAME = 'rideshare-offline-v1';
const OFFLINE_URL = './offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('rideshare-offline-') && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )));
});

// Only handle page navigation. API responses and personal data are never cached.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
