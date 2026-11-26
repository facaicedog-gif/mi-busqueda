// Mi búsqueda · service worker: deja instalar la app, abrirla sin red y recibir avisos.
// Sube CACHE en cada publicación.
const CACHE = 'busqueda-v6';
const BASE = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'politica.html'];
const FN = 'https://hlnxrveoytobqrwrbdvi.supabase.co/functions/v1/empleo';
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

// 26-nov · Aviso de convocatoria. Android y computador muestran los dos botones;
// el iPhone no muestra botones en apps web: al tocarlo se abre la convocatoria.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: e.data && e.data.text() }; }
  const opciones = {
    body: d.body || '', tag: d.tag, renotify: !!d.tag, requireInteraction: true,
    vibrate: [200, 90, 200, 90, 450], icon: 'icon.svg', badge: 'icon.svg',
    data: { token: d.token || '', url: d.url || './' },
  };
  if (d.token) opciones.actions = [{ action: 'si', title: '✓ Participar' }, { action: 'no', title: 'No me interesa' }];
  e.waitUntil(self.registration.showNotification(d.title || 'Mi búsqueda', opciones));
});

async function abrir(url, token) {
  const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of lista) if ('focus' in c) { if (token) c.postMessage({ conv: token }); return c.focus(); }
  return self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (e) => {
  const { token, url } = e.notification.data || {};
  e.notification.close();
  if (token && (e.action === 'si' || e.action === 'no')) {
    // Respuesta directa desde la notificación: el token basta, no hace falta abrir la app.
    e.waitUntil(fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'responder', token, quiere: e.action === 'si' }) })
      .then((r) => r.json())
      .then((j) => {
        const est = j && j.resultado && j.resultado.r_estado;
        const t = est === 'participa' ? '¡Estás dentro! 🎉' : est === 'tarde' ? 'Cupo completo' : est === 'no' ? 'Listo' : 'Mi búsqueda';
        const b = est === 'participa' ? 'Toca para ver la empresa, el lugar de trabajo y el contacto.'
          : est === 'tarde' ? 'Se llenaron los cupos antes de tu respuesta. Te avisaremos de la próxima.'
          : est === 'no' ? 'No te volveremos a mostrar esta convocatoria.' : 'Abre la app para ver la convocatoria.';
        self.clients.matchAll({ type: 'window' }).then((l) => l.forEach((c) => c.postMessage({ actualizar: true })));
        return self.registration.showNotification(t, { body: b, tag: 'resp-' + token.slice(0, 12), icon: 'icon.svg', data: { token, url: './?conv=' + token } });
      })
      .catch(() => abrir('./?conv=' + token, token)));
    return;
  }
  e.waitUntil(abrir(token ? './?conv=' + token : (url || './'), token));
});
