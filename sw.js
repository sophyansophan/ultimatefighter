const CACHE_NAME = 'uf-sim-cache-v1';
const CDN_CACHE_NAME = 'uf-sim-cdn-cache-v1';

// Daftar file lokal yang akan di-cache saat aplikasi pertama kali diinstal
const localResources = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  // Memaksa Service Worker baru untuk langsung mengambil alih tanpa menunggu tab ditutup
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(localResources);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Membersihkan cache lama jika ada update struktur
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== CDN_CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Hanya proses metode GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // STRATEGI 1: Cache-First untuk Library Eksternal (CDN React, Tailwind, Lucide)
  // Karena library ini jarang berubah, kita ambil dari cache dulu biar loading cepat.
  if (url.hostname.includes('cdn.tailwindcss.com') || url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CDN_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // STRATEGI 2: Network-First (Utamakan Jaringan) untuk File Lokal (index.html, dll)
  // Memastikan Anda SELALU melihat update terbaru jika mengupdate file di Github!
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Jika internet jalan dan dapat file baru, perbarui cache secara diam-diam
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // Jika internet terputus (Offline), fallback menggunakan file dari cache
        return caches.match(event.request);
      })
  );
});
