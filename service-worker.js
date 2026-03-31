const CACHE_NAME = 'mobiledev-v12';
const ASSETS = [
  '/Mobile-Dev/',
  '/Mobile-Dev/index.html',
  '/Mobile-Dev/style.css',
  '/Mobile-Dev/app.js',
  '/Mobile-Dev/db.js',
  '/Mobile-Dev/manifest.json',
  '/Mobile-Dev/icon-192.png',
  '/Mobile-Dev/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  // Ne pas attendre — s'activer immédiatement
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  // Prendre le contrôle de tous les onglets ouverts immédiatement
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

// Informer l'app qu'une mise à jour est disponible
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
