import { describe, it, expect } from "vitest";
import { GET } from "../route";
import { verifyCsrf, CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";
import { NextRequest } from "next/server";

// ─── GET /api/auth/csrf ───────────────────────────────────────────────────────

describe("GET /api/auth/csrf", () => {
  it("returns 200 with ok:true and a token string", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });

  it("sets a HttpOnly cookie named __kora_csrf", async () => {
    const res = await GET();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(CSRF_COOKIE);
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("cookie value matches the returned token", async () => {
    const res = await GET();
    const body = await res.json();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(body.token);
  });

  it("returns a different token on each call (tokens rotate)", async () => {
    const [r1, r2] = await Promise.all([GET(), GET()]);
    const [b1, b2] = await Promise.all([r1.json(), r2.json()]);
    expect(b1.token).not.toBe(b2.token);
  });

  it("token is a valid UUID v4 format", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("sets SameSite=Strict on the cookie", async () => {
    const res = await GET();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain("samesite=strict");
  });
});

// ─── verifyCsrf helper ────────────────────────────────────────────────────────

function makeRequest(opts: { cookie?: string; header?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.header) headers.set(CSRF_HEADER, opts.header);
  if (opts.cookie) headers.set("cookie", `${CSRF_COOKIE}=${opts.cookie}`);
  return new NextRequest("http://localhost/api/test", { method: "POST", headers });
}

describe("verifyCsrf", () => {
  it("returns null when header and cookie match", () => {
    const token = crypto.randomUUID();
    const result = verifyCsrf(makeRequest({ cookie: token, header: token }));
    expect(result).toBeNull();
  });

  it("returns 403 when header is missing", async () => {
    const token = crypto.randomUUID();
    const result = verifyCsrf(makeRequest({ cookie: token }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toMatch(/missing/i);
  });

  it("returns 403 when cookie is missing", async () => {
    const token = crypto.randomUUID();
    const result = verifyCsrf(makeRequest({ header: token }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("returns 403 when header and cookie do not match", async () => {
    const result = verifyCsrf(
      makeRequest({ cookie: crypto.randomUUID(), header: crypto.randomUUID() })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toMatch(/mismatch/i);
  });

  it("returns 403 when both are empty strings", () => {
    const result = verifyCsrf(makeRequest({ cookie: "", header: "" }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ─── Protected routes reject requests without CSRF ────────────────────────────

describe("POST /api/auth/challenge — CSRF guard", () => {
  it("returns 403 when x-kora-csrf header is absent", async () => {
    const { POST } = await import("../../challenge/route");
    const req = makeRequest(); // no cookie, no header
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when token does not match", async () => {
    const { POST } = await import("../../challenge/route");
    const req = makeRequest({ cookie: "token-a", header: "token-b" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/verify — CSRF guard", () => {
  it("returns 403 when x-kora-csrf header is absent", async () => {
    const { POST } = await import("../../verify/route");
    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/feedback — CSRF guard", () => {
  it("returns 403 when x-kora-csrf header is absent", async () => {
    const { POST } = await import("../../../../feedback/route");
    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
