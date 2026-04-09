// ════════════════════════════════════════════════
// Snake Matemático — Service Worker
// Versão: 1.0.0
// ════════════════════════════════════════════════

const CACHE_NAME   = 'snake-mat-v1';
const FONTS_CACHE  = 'snake-fonts-v1';

const CORE_ASSETS = [
  './index.html',
  './snake-manifest.json',
  './snake-icon.svg',
  './snake-sw.js',
];

// ── INSTALAÇÃO ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW Snake] Cacheando assets...');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW Snake] Pronto para jogar offline! 🐍');
        return self.skipWaiting();
      })
  );
});

// ── ATIVAÇÃO: limpa caches antigos ──
self.addEventListener('activate', (event) => {
  const VALIDOS = [CACHE_NAME, FONTS_CACHE];
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((n) => !VALIDOS.includes(n))
          .map((n) => { console.log('[SW Snake] Removendo cache antigo:', n); return caches.delete(n); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Fontes Google → Stale While Revalidate (cache imediato + atualiza em background)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event.request, FONTS_CACHE));
    return;
  }

  // Assets locais → Cache First
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js')   ||
    url.pathname.endsWith('.svg')  ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/'
  ) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // Resto → Network First
  event.respondWith(networkFirst(event.request, CACHE_NAME));
});

// ── ESTRATÉGIAS ──

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match('./index.html');
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || networkFetch;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
