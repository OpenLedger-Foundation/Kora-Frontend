/** @type {import('next').NextConfig} */

// ─── Content Security Policy ──────────────────────────────────────────────────
// Directives are intentionally explicit — only allow what the app actually needs.
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],

  // Scripts: self + inline required for the theme-init script in layout.tsx
  // In production, replace 'unsafe-inline' with a nonce-based approach.
  "script-src": ["'self'", "'unsafe-inline'"],

  // Styles: self + inline (Tailwind injects inline styles at runtime)
  "style-src": ["'self'", "'unsafe-inline'"],

  // Images: self + data URIs + all IPFS gateways used for invoice documents
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

  // Fonts: self only (Google Fonts are loaded via next/font, served from self)
  "font-src": ["'self'"],

  // Connections: Stellar RPC, Horizon, IPFS APIs, wallet kit WebSocket
  "connect-src": [
    "'self'",
    "https://soroban-testnet.stellar.org",
    "https://horizon-testnet.stellar.org",
    "https://horizon.stellar.org",
    "https://api.pinata.cloud",
    "https://gateway.pinata.cloud",
    "https://ipfs.io",
    "https://cloudflare-ipfs.com",
    // Stellar Wallets Kit uses WebSocket for wallet communication
    "wss:",
  ],

  // Frames: deny all — no iframes needed
  "frame-src": ["'none'"],
  "frame-ancestors": ["'none'"],

  // Objects: deny Flash/plugins
  "object-src": ["'none'"],

  // Base URI: restrict to self to prevent base-tag injection
  "base-uri": ["'self'"],

  // Form submissions: self only
  "form-action": ["'self'"],

  // Workers: self + blob (required for some wallet kit internals)
  "worker-src": ["'self'", "blob:"],
};

function buildCspHeader() {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

// ─── Security Headers ─────────────────────────────────────────────────────────
const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: buildCspHeader(),
  },
  {
    // Prevent clickjacking — belt-and-suspenders alongside frame-ancestors CSP
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Prevent MIME-type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Control referrer information sent with requests
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Enforce HTTPS for 1 year, include subdomains
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    // Restrict browser features not used by the app
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    // Opt out of Google's FLoC / Topics API
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@stellar/stellar-sdk"],
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: SECURITY_HEADERS,
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
    // Required for Stellar SDK in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
