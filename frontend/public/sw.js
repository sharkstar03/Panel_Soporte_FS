/* Service Worker — QUANTIUM Soporte Ops PWA
 * Estrategia:
 *  - /api/*  → NUNCA se cachea (datos sensibles: tokens, credenciales).
 *  - navegación (HTML) → network-first con fallback offline al app shell.
 *  - estáticos (js/css/img) → stale-while-revalidate.
 */
const CACHE = 'qso-cache-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-cyan.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;        // solo mismo origen
  if (url.pathname.startsWith('/api')) return;            // nunca cachear la API

  // Navegaciones: red primero, si falla servimos el shell (modo offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Estáticos: respondemos de cache y refrescamos en segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
