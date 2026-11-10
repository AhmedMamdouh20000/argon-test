// Service Worker لتطبيق «مُخطّطي» — Cache-first للأصول الثابتة مع استثناء طلبات Supabase
const CACHE_NAME = 'mk-v3.1.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/core/util.js',
  './js/core/store.js',
  './js/core/quick.js',
  './js/core/prayer.js',
  './js/core/sound.js',
  './js/core/notify.js',
  './js/core/ics.js',
  './js/core/cloud.js',
  './js/core/report-core.js',
  './js/features/today.js',
  './js/features/prayer.js',
  './js/features/alerts.js',
  './js/features/money.js',
  './js/features/events.js',
  './js/features/reports.js',
  './js/features/more.js',
  './js/ui/arc.js',
  './js/ui/ui.js',
  './js/ui/onboarding.js',
  './js/vendor/adhan.min.js',
  './js/vendor/supabase.js',
  './assets/adhan.mp3',
  './assets/fonts/readex-arabic.woff2',
  './assets/fonts/readex-latin.woff2',
  './assets/fonts/ruqaa.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ممنوع عمل cache لأي طلب يخص Supabase
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/rest/v1') || url.pathname.includes('/auth/v1')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
