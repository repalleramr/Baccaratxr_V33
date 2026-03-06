const CACHE='v33pro-cache';
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./manifest.json',
  './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./poster/poster-1024.png'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
