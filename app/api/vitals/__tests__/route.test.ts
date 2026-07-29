/**
 * Integration tests for POST /api/vitals and GET /api/vitals
 *
 * Covers:
 *  - CSRF guard on POST
 *  - Invalid payload shapes (400)
 *  - Empty metrics array (204)
 *  - Valid metrics payload (204)
 *  - GET health-check (200)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";

function makePostRequest(body: unknown): NextRequest {
  const token = crypto.randomUUID();
  return new NextRequest("http://localhost/api/vitals", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      cookie: `${CSRF_COOKIE}=${token}`,
      [CSRF_HEADER]: token,
    }),
    body: JSON.stringify(body),
  });
}

const VALID_METRIC = {
  name: "LCP",
  value: 1234,
  id: "v3-abc-123",
  label: "web-vital",
  startTime: 0,
  rating: "good",
  url: "/marketplace",
  userAgent: "test-agent",
  timestamp: Date.now(),
};

describe("POST /api/vitals", () => {
  beforeEach(() => { vi.resetModules(); });

  it("returns 403 when CSRF header is absent", async () => {
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/vitals", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when body has no metrics field", async () => {
    const { POST } = await import("../route");
    const res = await POST(makePostRequest({ other: "data" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when metrics is not an array", async () => {
    const { POST } = await import("../route");
    const res = await POST(makePostRequest({ metrics: "not-an-array" }));
    expect(res.status).toBe(400);
  });

  it("returns 204 when metrics array is empty after filtering", async () => {
    const { POST } = await import("../route");
    const res = await POST(makePostRequest({ metrics: [] }));
    expect(res.status).toBe(204);
  });

  it("returns 204 for a valid metrics payload", async () => {
    const { POST } = await import("../route");
    const res = await POST(makePostRequest({ metrics: [VALID_METRIC] }));
    expect(res.status).toBe(204);
  });

  it("returns 204 for multiple valid metrics", async () => {
    const { POST } = await import("../route");
    const metrics = [
      VALID_METRIC,
      { ...VALID_METRIC, name: "FCP", id: "v3-fcp-1", value: 800 },
      { ...VALID_METRIC, name: "CLS", id: "v3-cls-1", value: 0.05 },
    ];
    const res = await POST(makePostRequest({ metrics }));
    expect(res.status).toBe(204);
  });

  it("silently drops malformed metrics entries and still returns 204", async () => {
    const { POST } = await import("../route");
    const metrics = [
      { not_a_metric: true },        // missing required fields — filtered out
      VALID_METRIC,                  // valid — kept
    ];
    const res = await POST(makePostRequest({ metrics }));
    expect(res.status).toBe(204);
  });
});

describe("GET /api/vitals", () => {
  beforeEach(() => { vi.resetModules(); });

  it("returns 200 with ok:true for health check", async () => {
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.endpoint).toBe("/api/vitals");
  });
});
