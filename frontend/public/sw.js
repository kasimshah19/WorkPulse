// WorkPulse Service Worker Placeholder
// next-pwa generates sw.js in production builds.
// TODO Phase 0/1: Custom offline caching strategies for workers in low-connectivity areas.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
