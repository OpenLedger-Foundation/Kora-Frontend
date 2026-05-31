/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",

  // ── Cache rules ────────────────────────────────────────────────────────────
  // Security: never cache wallet, transaction, or auth pages/APIs.
  // These pages handle signing keys and sensitive tx state — must always be
  // fetched fresh from the network.
  buildExcludes: [/middleware-manifest\.json$/],

  runtimeCaching: [
    // 1. Google Fonts stylesheet — stale-while-revalidate
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-fonts-stylesheets",
        expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    // 2. Google Fonts files — cache-first (immutable)
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // 3. Next.js static assets (_next/static) — cache-first (content-hashed)
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static-assets",
        expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // 4. Next.js image optimization — stale-while-revalidate
    {
      urlPattern: /^\/_next\/image\?.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "next-image-cache",
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    // 5. Public static files (icons, manifest, og-image) — cache-first
    {
      urlPattern: /^\/(?:icons|og-image|manifest\.json).*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-public",
        expiration: { maxEntries: 32, maxAgeSeconds: 30 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // 6. Marketplace page — stale-while-revalidate (safe to serve cached)
    {
      urlPattern: /^\/marketplace(\/)?$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "marketplace-page",
        expiration: { maxEntries: 4, maxAgeSeconds: 5 * 60 },
      },
    },
    // 7. Home page — stale-while-revalidate
    {
      urlPattern: /^\/$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "home-page",
        expiration: { maxEntries: 2, maxAgeSeconds: 5 * 60 },
      },
    },
    // 8. IPFS gateway images — stale-while-revalidate
    {
      urlPattern: /^https:\/\/(?:gateway\.pinata\.cloud|ipfs\.io|cloudflare-ipfs\.com)\/.*/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "ipfs-assets",
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // NOTE: The following are intentionally NOT cached (security):
    //   /dashboard/*       — wallet-connected pages with live position data
    //   /transactions/*    — on-chain tx history, must be fresh
    //   /invoice/create/*  — signing flow, must never be stale
    //   /api/auth/*        — challenge/verify endpoints
    //   /api/upload/*      — file upload endpoint
  ],

  // Offline fallback — shown when a navigation request fails and no cache hit
  fallbacks: {
    document: "/offline",
  },
});

// ─── Content Security Policy ──────────────────────────────────────────────────
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://ipfs.io",
    "https://gateway.pinata.cloud",
    "https://cloudflare-ipfs.com",
    "https://nftstorage.link",
    "https://*.ipfs.dweb.link",
    // Wallet provider icons
    "https://assets.freighter.app",
    "https://xbull.app",
    "https://lobstr.co",
    "https://albedo.link",
  ],
  "font-src": ["'self'"],
  "connect-src": [
    "'self'",
    "https://soroban-testnet.stellar.org",
    "https://horizon-testnet.stellar.org",
    "https://horizon.stellar.org",
    "https://api.pinata.cloud",
    "https://gateway.pinata.cloud",
    "https://ipfs.io",
    "https://cloudflare-ipfs.com",
    "wss:",
  ],
  "frame-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  // Service worker requires 'self'; blob: for wallet kit internals
  "worker-src": ["'self'", "blob:"],
};

function buildCspHeader() {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: buildCspHeader() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@stellar/stellar-sdk"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      // Service worker must be served without caching headers so browsers
      // always check for updates.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/workbox-:hash.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },

  images: {
    // Serve modern formats — Next.js negotiates AVIF → WebP → original
    formats: ["image/avif", "image/webp"],

    // Standard responsive breakpoints
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],

    remotePatterns: [
      // IPFS gateways (invoice document thumbnails / metadata images)
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "nftstorage.link" },
      { protocol: "https", hostname: "*.ipfs.dweb.link" },

      // Wallet provider icon CDNs
      { protocol: "https", hostname: "assets.freighter.app" },
      { protocol: "https", hostname: "xbull.app" },
      { protocol: "https", hostname: "lobstr.co" },
      { protocol: "https", hostname: "albedo.link" },
    ],
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = withNextIntl(withPWA(nextConfig));
