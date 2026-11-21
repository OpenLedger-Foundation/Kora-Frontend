import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeRequest(body: any, hasCsrf = true): NextRequest {
  const token = crypto.randomUUID();
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-request-id": "test-req-id",
  });
  if (hasCsrf) {
    headers.set("x-kora-csrf", token);
    headers.set("cookie", `__kora_csrf=${token}`);
  }
  return new NextRequest("http://localhost/api/vitals", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeMetric(overrides: Record<string, any> = {}) {
  return {
    name: "FCP",
    value: 120,
    id: "v4-123",
    label: "web-vital",
    startTime: 0,
    rating: "good",
    url: "/dashboard",
    userAgent: "Mozilla",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("POST /api/vitals", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 400 for malformed payload", async () => {
    const req = makeRequest({ invalidKey: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid payload");
  });

  it("returns 204 and does not forward if ANALYTICS_INGEST_URL is not set", async () => {
    delete process.env.ANALYTICS_INGEST_URL;
    const req = makeRequest({ metrics: [makeMetric()] });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards metrics when ANALYTICS_INGEST_URL is set", async () => {
    process.env.ANALYTICS_INGEST_URL = "https://analytics.example.com/ingest";
    mockFetch.mockResolvedValueOnce({ ok: true });

    const req = makeRequest({ metrics: [makeMetric()] });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://analytics.example.com/ingest",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-request-id": "test-req-id",
        }),
      })
    );
  });

  it("returns 204 even if forwarding to ANALYTICS_INGEST_URL fails (fails open)", async () => {
    process.env.ANALYTICS_INGEST_URL = "https://analytics.example.com/ingest";
    mockFetch.mockRejectedValueOnce(new Error("Network Error"));

    const req = makeRequest({ metrics: [makeMetric()] });
    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("redacts wallet addresses from the URL and payload in forwarded request", async () => {
    process.env.ANALYTICS_INGEST_URL = "https://analytics.example.com/ingest";
    mockFetch.mockResolvedValueOnce({ ok: true });

    const walletAddress = "GBXW67SZ67SZ67SZ67SZ67SZ67SZ67SZ67SZ67SZ67SZ67SZ67SZ67SZ"; // exactly 56 chars G...
    const req = makeRequest({
      metrics: [
        makeMetric({
          url: `/dashboard/sme/${walletAddress}`,
          context: { wallet: walletAddress },
        }),
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(mockFetch).toHaveBeenCalled();
    const callArgs = mockFetch.mock.calls[0];
    const bodySent = JSON.parse(callArgs[1].body);
    expect(bodySent[0].url).not.toContain(walletAddress);
    expect(bodySent[0].url).toContain("[REDACTED_WALLET]");
    expect(bodySent[0].context.wallet).toBe("[REDACTED_WALLET]");
  });

  it("redacts invoice ids and query params from the URL", async () => {
    process.env.ANALYTICS_INGEST_URL = "https://analytics.example.com/ingest";
    mockFetch.mockResolvedValueOnce({ ok: true });

    const req = makeRequest({
      metrics: [
        makeMetric({
          url: "/invoices/INV-2024-000123?email=user%40example.com&token=abc123",
        }),
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    const bodySent = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(bodySent[0].url).not.toContain("INV-2024-000123");
    expect(bodySent[0].url).not.toContain("user%40example.com");
    expect(bodySent[0].url).not.toContain("abc123");
    expect(bodySent[0].url).toContain("[REDACTED_INVOICE]");
    expect(bodySent[0].url).toContain("[REDACTED_QUERY]");
  });

  it("redacts PII from custom attributes in the forwarded payload", async () => {
    process.env.ANALYTICS_INGEST_URL = "https://analytics.example.com/ingest";
    mockFetch.mockResolvedValueOnce({ ok: true });

    const req = makeRequest({
      metrics: [
        makeMetric({
          context: {
            email: "user@example.com",
            invoiceId: "INV-2024-000123",
            address: "123 Main Street, Springfield",
            nested: { phone: "+1-555-123-4567" },
            safe: "dashboard",
          },
        }),
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    const bodySent = JSON.parse(mockFetch.mock.calls[0][1].body);
    const ctx = bodySent[0].context;
    expect(ctx.email).toBe("[REDACTED]");
    expect(ctx.invoiceId).toBe("[REDACTED]");
    expect(ctx.address).toBe("[REDACTED]");
    expect(ctx.nested.phone).toBe("[REDACTED]");
    expect(ctx.safe).toBe("dashboard");
  });

  it("handles metrics without a url or context without throwing", async () => {
    process.env.ANALYTICS_INGEST_URL = "https://analytics.example.com/ingest";
    mockFetch.mockResolvedValueOnce({ ok: true });

    const req = makeRequest({
      metrics: [makeMetric({ url: undefined, context: undefined })],
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    const bodySent = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(bodySent[0].url).toBeUndefined();
    expect(bodySent[0].context).toBeUndefined();
  });
});
