/* Service worker — offline app shell */
const CACHE = 'waktu-solat-v31';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './js/jakim-data.js',
  './js/core.js',
  './js/compass.js',
  './js/ui.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  var networkFirst = /\\.(js|css|html)$/i.test(url) || url.endsWith('/');
  if (networkFirst) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) {
        fetch(e.request)
          .then((res) => {
            if (res && res.ok) caches.open(CACHE).then((c) => c.put(e.request, res));
          })
          .catch(() => {});
        return cached;
      }
      return fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
