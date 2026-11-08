/*
 * Cakeita offline support. Pages and app files are cached as they load, so after one visit
 * Cakeita opens and works with no signal (orders still travel by Messenger link later).
 * - Page (navigation): network first, cached copy when offline.
 * - App files (hashed /assets/*), fonts, icons: cache first (they never change once built).
 * - Never cached: the AI endpoint (/api/), and anything from other sites (maps, Firebase).
 */
const VERSION = 'cakeita-v5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(VERSION);
      await c.addAll(SHELL);
      // Every app file from this build (listed at build time), so pages not opened yet also work offline.
      try {
        const list = await (await fetch('./precache.json', { cache: 'no-store' })).json();
        await c.addAll(list.map((f) => `./${f}`));
      } catch {
        /* partial cache is fine; files are added as they load */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Only the app shell is kept for offline; other pages (privacy.html) are not.
          if (res.ok && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true }).then((r) => r || caches.match('./', { ignoreVary: true }))),
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreVary: true, ignoreSearch: false }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes('/assets/') || /\.(png|svg|woff2?|webmanifest)$/.test(url.pathname))) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Phone notifications: "new cake request" for bakers, "quote ready" for customers.
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: 'Cakeita', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Cakeita', {
      body: d.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: d.tag || undefined,
      data: { url: d.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          c.navigate(target).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
