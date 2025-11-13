// Service Worker para PWA
const CACHE_NAME = 'lavadoras-global-v1';
const RUNTIME_CACHE = 'lavadoras-global-runtime-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo_apk.png',
  '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache abierto');
        return cache.addAll(urlsToCache.map(url => new Request(url, {credentials: 'same-origin'})));
      })
      .catch((error) => {
        console.error('Service Worker: Error al cachear recursos', error);
      })
  );
  // Activar inmediatamente el nuevo service worker
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Service Worker: Eliminando cache antiguo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Tomar control inmediatamente de todas las páginas
  return self.clients.claim();
});

// Estrategia de caché: Network First, luego Cache
self.addEventListener('fetch', (event) => {
  // Ignorar solicitudes no GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignorar solicitudes de Firebase/APIs externas que deben ir siempre a la red
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin && 
      (url.hostname.includes('firebase') || 
       url.hostname.includes('googleapis') ||
       url.hostname.includes('google'))) {
    return;
  }

  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) => {
      return fetch(event.request)
        .then((response) => {
          // Solo cachear respuestas exitosas
          if (response.status === 200) {
            // Clonar la respuesta para cachearla
            const responseToCache = response.clone();
            cache.put(event.request, responseToCache);
          }
          return response;
        })
        .catch(() => {
          // Si falla la red, intentar desde cache
          return cache.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Si no hay en cache y es una navegación, devolver index.html
            if (event.request.mode === 'navigate') {
              return cache.match('/index.html');
            }
          });
        });
    })
  );
});

