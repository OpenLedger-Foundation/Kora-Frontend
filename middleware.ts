import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";

const PROTECTED = ["/invoice/create", "/dashboard/sme", "/dashboard/investor"];

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

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ── X-Request-ID (#277) ───────────────────────────────────────────────────
  // Generate a unique request ID for every request. API routes read this from
  // the incoming request header so they can include it in error response bodies.
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  // ── Locale cookie: set on first visit if not already present ──────────────
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);

  if (!req.cookies.get("kora-locale")) {
    const detected = detectLocaleFromHeader(req);
    response.cookies.set("kora-locale", detected, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
  }

  // ── Protected route guard ─────────────────────────────────────────────────
  for (const p of PROTECTED) {
    if (pathname === p || pathname.startsWith(p + "/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("redirectTo", pathname + (search || ""));
      const redirect = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
      redirect.headers.set("x-request-id", requestId);
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes so X-Request-ID is universal
    "/((?!_next/static|_next/image|favicon.ico|icons|wallets|manifest.json).*)",
  ],
};
