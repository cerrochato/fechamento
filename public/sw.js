// Service worker: guarda as telas do app no celular para abrir sem sinal.
// Páginas e arquivos do próprio app: tenta a internet primeiro e, se falhar, usa a cópia guardada.
// Chamadas ao Supabase não passam por aqui (outro domínio).
const CACHE = 'fechamento-v1';
const TELAS = ['/', '/gravar', '/contagem', '/lancar', '/login'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(TELAS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: u.pathname.startsWith('/contagem/ver') })
      .then(r => r || caches.match('/')))
  );
});
