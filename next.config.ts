import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "nftstorage.link" },
      { protocol: "https", hostname: "*.ipfs.dweb.link" },
      { protocol: "https", hostname: "assets.freighter.app" },
      { protocol: "https", hostname: "xbull.app" },
      { protocol: "https", hostname: "lobstr.co" },
      { protocol: "https", hostname: "albedo.link" },
    ],
  },
  experimental: {
    // Enable server actions
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
  webpack: (config) => {
    // Required for stellar-sdk in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
