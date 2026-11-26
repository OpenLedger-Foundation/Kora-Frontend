import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  getLocaleCookieOptions,
  resolveLocaleFromRequest,
} from "@/i18n/locale";
import { locales, defaultLocale } from "@/i18n/config";
import {
  isAutomatedClientUserAgent,
  isBotChallengeBypassed,
} from "@/lib/botChallenge";

/**
 * Health/uptime probes must never be challenged, redirected or gated.
 * Keep this list exact — adding a broad prefix here would create an
 * unauthenticated bypass for unrelated routes.
 */
const HEALTH_CHECK_PATHS = new Set([
  "/api/health",
  "/health",
  "/api/healthz",
  "/healthz",
]);

/**
 * Detect the best locale from the Accept-Language header.
 * Falls back to the default locale if no match is found.
 */
function detectLocaleFromHeader(req: NextRequest): string {
  const acceptLanguage = req.headers.get("accept-language") ?? "";
  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().split("-")[0].toLowerCase());

  for (const lang of preferred) {
    if (locales.includes(lang as (typeof locales)[number])) return lang;
  }
  return defaultLocale;
}

/**
 * Builds a nonce-scoped CSP script-src so inline <script nonce="..."> tags
 * are allow-listed per-request instead of relying on 'unsafe-inline'
 * (next.config.js keeps 'unsafe-inline' only for dev-mode fallback).
 */
function buildNonceCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return `script-src ${scriptSrc}`;
}

export function middleware(req: NextRequest) {
  // Uptime monitors hit these paths from outside the app; let them through
  // before any redirect/gating logic. Normal pages keep the full pipeline.
  if (HEALTH_CHECK_PATHS.has(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // ── Gate /test-components behind dev-only guard (#725) ─────────────────────
  if (
    req.nextUrl.pathname === "/test-components" ||
    req.nextUrl.pathname.startsWith("/test-components/")
  ) {
    const isDev = process.env.NODE_ENV !== "production";
    const isFlagEnabled =
      process.env.NEXT_PUBLIC_ENABLE_TEST_COMPONENTS === "true";
    if (!isDev && !isFlagEnabled) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // ── Bot challenge allowlist (#1228) ───────────────────────────────────────
  // Opt-in via BOT_CHALLENGE_TOKEN. Health endpoints and recognised uptime
  // monitors are exempt; auth-protected routes are never exempt.
  const userAgent = req.headers.get("user-agent");
  const botBypass = isBotChallengeBypassed({
    pathname: req.nextUrl.pathname,
    userAgent,
  });
  const challengeToken = process.env.BOT_CHALLENGE_TOKEN;
  if (
    challengeToken &&
    !botBypass &&
    isAutomatedClientUserAgent(userAgent) &&
    req.headers.get("x-kora-bot-token") !== challengeToken
  ) {
    return NextResponse.json(
      { error: "bot_challenge_required" },
      {
        status: 403,
        headers: {
          "x-kora-bot-challenge": "required",
        },
      }
    );
  }

  // ── X-Request-ID (#277) ───────────────────────────────────────────────────
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  if (botBypass) requestHeaders.set("x-kora-bot-bypass", "true");

  // ── CSP nonce (per-request) ───────────────────────────────────────────────
  const nonce = crypto.randomUUID();
  requestHeaders.set("x-nonce", nonce);

  // ── Locale: read cookie for SSR, fall back to Accept-Language ─────────────
  const acceptLanguage = req.headers.get("accept-language") ?? "";
  const cookieValue = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = resolveLocaleFromRequest(cookieValue, acceptLanguage);
  requestHeaders.set("x-kora-locale", locale);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  if (botBypass) response.headers.set("x-kora-bot-bypass", "true");
  // Override the static script-src from next.config.js with a per-request
  // nonce-scoped one — the CSP directive itself is unaffected, only the
  // Content-Security-Policy header value is replaced.
  const existingCsp = response.headers.get("Content-Security-Policy");
  if (existingCsp) {
    const nonceScriptSrc = buildNonceCsp(nonce);
    const withoutScriptSrc = existingCsp.replace(/script-src[^;]*/, "").trim();
    response.headers.set(
      "Content-Security-Policy",
      [nonceScriptSrc, withoutScriptSrc].filter(Boolean).join("; ")
    );
  }

  if (!cookieValue || cookieValue !== locale) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, getLocaleCookieOptions(process.env.NODE_ENV === "production"));
  }

  // Wallet-gated routes (/invoice/create, /dashboard/sme, /dashboard/investor)
  // are guarded client-side by ConnectWalletGuard instead of here: wallet
  // connection state lives in the browser (wallet extension + localStorage),
  // so middleware has no server-readable signal to gate on. A prior version
  // of this middleware unconditionally rewrote /invoice/create to "/" for
  // every visitor regardless of wallet state, which made that route
  // permanently unreachable — removed rather than papered over.
  //
  // KYB verification gating (Issue #489 — `kyb-mint-gate` flag):
  // `kycStatus` is also stored in localStorage via Zustand persist, making
  // it equally inaccessible to Edge middleware.  The KYB gate is therefore
  // enforced at the page level inside `app/invoice/create/page.tsx`, where
  // the full store is available and the wizard step context is known.
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|wallets|manifest.json).*)",
  ],
};
