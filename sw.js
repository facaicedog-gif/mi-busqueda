// Mi búsqueda · service worker mínimo: deja instalar la app y abrirla sin red.
// Sube CACHE en cada publicación.
const CACHE = 'busqueda-v1';
const BASE = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'politica.html'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Primero la red (para ver siempre lo último) y, sin red, lo guardado. Sólo lo propio, nunca Supabase.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-store' })
    .then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
