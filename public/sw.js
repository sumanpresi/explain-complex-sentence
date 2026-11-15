const cacheName = 'sentence-lens-shell-v5';
const shell = ['/', '/style.css', '/app.mjs', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name !== cacheName && name.startsWith('sentence-lens-shell-')).map(name => caches.delete(name))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !shell.includes(url.pathname) || url.search) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname)));
});