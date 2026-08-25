import { NextResponse } from "next/server";
import { issueCsrfToken } from "@/lib/csrf";

/**
 * GET /api/auth/csrf
 *
 * Issues a CSRF token for the current browser session.
 * - Sets a `__kora_csrf` HttpOnly cookie (SameSite=Strict).
 * - Returns the same token in the JSON body so the client can store it
 *   and attach it as the `x-kora-csrf` header on mutating requests.
 *
 * Call this once on page load (or on session change) before submitting
 * any POST/PUT/PATCH/DELETE request to protected routes.
 */
export async function GET(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true, token: "" });
  const token = issueCsrfToken(response);
  // Overwrite the placeholder with the real token
  return NextResponse.json({ ok: true, token }, {
    headers: response.headers,
  });
}
