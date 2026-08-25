/**
 * CSRF protection helpers for Kora API routes.
 *
 * Model:
 *  1. Client calls GET /api/auth/csrf which sets a `__kora_csrf` HttpOnly
 *     cookie and returns the same token in the JSON body.
 *  2. Client reads the token from the response and attaches it as the
 *     `x-kora-csrf` request header on every mutating request (POST/PUT/PATCH/DELETE).
 *  3. Each protected route calls verifyCsrf(request). The helper reads both
 *     the header and the cookie and rejects the request with 403 if they
 *     don't match or if either is absent.
 *
 * Why this works (double-submit cookie pattern):
 *  Cross-origin requests cannot read HttpOnly cookies, so an attacker cannot
 *  forge the header value even if the cookie is sent automatically by the browser.
 *
 * Token rotation:
 *  Tokens are scoped to a session by including a server-generated random UUID.
 *  Calling GET /api/auth/csrf again issues a new token, invalidating the previous one.
 */

import { NextRequest, NextResponse } from "next/server";

export const CSRF_COOKIE = "__kora_csrf";
export const CSRF_HEADER = "x-kora-csrf";

/**
 * Verify the CSRF token on an incoming mutating request.
 *
 * Returns null when the token is valid.
 * Returns a 403 NextResponse when the token is missing or does not match.
 */
export function verifyCsrf(request: NextRequest): NextResponse | null {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      { error: "CSRF token missing" },
      { status: 403 }
    );
  }

  if (cookieToken !== headerToken) {
    return NextResponse.json(
      { error: "CSRF token mismatch" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Generate a new CSRF token and attach it to a response as a HttpOnly cookie.
 * The same token value is returned so callers can include it in the JSON body.
 */
export function issueCsrfToken(response: NextResponse): string {
  const token = crypto.randomUUID();
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // No explicit maxAge — token lives for the browser session
  });
  return token;
}
