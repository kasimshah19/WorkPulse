const runtimeCaching = [
  // 1. CRITICAL: Money, Escrow, Attendance, Disputes, Payments, Incidents, Auth must NEVER be cached
  {
    urlPattern: /\/api\/v1\/(wallet|escrow|attendance|disputes|payments|auth|incidents)(\/.*)?$/i,
    handler: 'NetworkOnly',
    options: {
      cacheName: 'workpulse-no-cache',
    },
  },
  // 2. Safe read-only skills & public catalogs: NetworkFirst with 24h fallback
  {
    urlPattern: /\/api\/v1\/voice\/skills$/i,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'workpulse-metadata-cache',
      expiration: {
        maxEntries: 16,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  // 3. Static media, fonts, images: StaleWhileRevalidate
  {
    urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'workpulse-static-assets',
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  // 4. Next.js static build scripts and chunks: StaleWhileRevalidate
  {
    urlPattern: /_next\/static\/.*/i,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'workpulse-next-static',
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
];

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
