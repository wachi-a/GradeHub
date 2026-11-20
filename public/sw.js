// Cache only same-origin app-shell requests. Never cache Supabase API responses.
const root = new URL('./', self.location.href).pathname;
const cacheName = 'gradeculator-static-v2';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.add(root)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('gradeculator-static-') && k !== cacheName).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(root)) return;
  if (req.mode !== 'navigate' && !/\.(?:js|css|png|svg|webmanifest)$/i.test(url.pathname)) return;
  e.respondWith(fetch(req).then(response => {
    if (response.ok) {
      const copy = response.clone();
      e.waitUntil(caches.open(cacheName).then(cache => cache.put(req, copy)));
    }
    return response;
  }).catch(() => caches.match(req).then(cached => cached || (req.mode === 'navigate' ? caches.match(root) : Response.error()))));
});
