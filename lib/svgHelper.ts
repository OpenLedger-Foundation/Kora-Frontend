/**
 * Helper utilities for inlining and sanitizing SVG wallet logos (< 1KB).
 */

const WALLET_LOGOS: Record<string, string> = {
  freighter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" width="32" height="32">
  <rect width="40" height="40" rx="10" fill="#6366F1"/>
  <path d="M10 14h20v3H10zM10 20h14v3H10zM10 26h17v3H10z" fill="#fff"/>
</svg>`,
  xbull: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" width="32" height="32">
  <rect width="40" height="40" rx="10" fill="#0EA5E9"/>
  <path d="M12 12l8 8-8 8h5l5.5-5.5L28 28h5l-8.5-8.5L33 12h-5l-5 5-5-5h-6z" fill="#fff"/>
</svg>`,
  lobstr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" width="32" height="32">
  <rect width="40" height="40" rx="10" fill="#14B8A6"/>
  <path d="M20 8c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8zm0 4a8 8 0 110 16A8 8 0 0120 12zm0 3a5 5 0 100 10A5 5 0 0020 15z" fill="#fff"/>
</svg>`,
  albedo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" width="32" height="32">
  <rect width="40" height="40" rx="10" fill="#8B5CF6"/>
  <path d="M20 9l2.5 7.5H30l-6 4.5 2.5 7.5L20 24l-6.5 4.5 2.5-7.5-6-4.5h7.5L20 9z" fill="#fff"/>
</svg>`
};

/**
 * Returns the SVG string for a given wallet ID if it is under 1KB and supported.
 */
export function getWalletIconSvg(walletId: string): string | null {
  return WALLET_LOGOS[walletId] || null;
}

/**
 * Sanitizes the SVG content using DOMPurify (runs on client side only).
 * Returns original content on server side to enable SSR hydration.
 */
export function sanitizeSvg(svgContent: string): string {
  if (typeof window === "undefined") {
    return svgContent;
  }
  // eslint-disable-next-line
  const DOMPurify = require("dompurify");
  return DOMPurify.sanitize(svgContent, { USE_PROFILES: { svg: true } });
}
