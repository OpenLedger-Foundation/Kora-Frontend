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
  // Parse "en-US,en;q=0.9,es;q=0.8" → ["en", "es", ...]
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

  // ── Locale cookie: set on first visit if not already present ──────────────
  const response = NextResponse.next();
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
      return NextResponse.rewrite(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/invoice/create",
    "/dashboard/sme",
    "/dashboard/investor",
    // Also run on root to set locale cookie on first visit
    "/",
  ],
};
