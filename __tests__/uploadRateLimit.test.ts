import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/upload/route";

describe("Upload Route IP Rate Limiting", () => {
  beforeEach(() => {
    (global as any).__resetIpRateLimit?.();
    process.env.PINATA_JWT = "mock-jwt";
  });

  it("allows up to 10 requests per minute and blocks the 11th", async () => {
    // Make 10 requests from the same IP
    for (let i = 0; i < 10; i++) {
      const req = new Request("https://kora.network/api/upload", {
        method: "POST",
        headers: {
          "x-forwarded-for": "1.2.3.4",
        },
      });
      const res = await POST(req);
      // It should NOT return 429. It will return 401 or similar (unauthorized) or 500, but not 429.
      expect(res.status).not.toBe(429);
    }

    // 11th request should be blocked with 429
    const req11 = new Request("https://kora.network/api/upload", {
      method: "POST",
      headers: {
        "x-forwarded-for": "1.2.3.4",
      },
    });
    const res11 = await POST(req11);
    expect(res11.status).toBe(429);
    expect(res11.headers.get("Retry-After")).toBeDefined();
    expect(Number(res11.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("handles multiple IPs independently", async () => {
    // IP 1 makes 10 requests
    for (let i = 0; i < 10; i++) {
      const req = new Request("https://kora.network/api/upload", {
        method: "POST",
        headers: {
          "x-forwarded-for": "1.1.1.1",
        },
      });
      const res = await POST(req);
      expect(res.status).not.toBe(429);
    }

    // IP 1 11th request is blocked
    const req1Block = new Request("https://kora.network/api/upload", {
      method: "POST",
      headers: {
        "x-forwarded-for": "1.1.1.1",
      },
    });
    const res1Block = await POST(req1Block);
    expect(res1Block.status).toBe(429);

    // IP 2 makes a request and is allowed
    const req2 = new Request("https://kora.network/api/upload", {
      method: "POST",
      headers: {
        "x-forwarded-for": "2.2.2.2",
      },
    });
    const res2 = await POST(req2);
    expect(res2.status).not.toBe(429);
  });

  it("extracts the client IP from a comma-separated x-forwarded-for header", async () => {
    // Send 10 requests with client IP '9.9.9.9' proxy chain
    for (let i = 0; i < 10; i++) {
      const req = new Request("https://kora.network/api/upload", {
        method: "POST",
        headers: {
          "x-forwarded-for": "9.9.9.9, 10.0.0.1, 10.0.0.2",
        },
      });
      const res = await POST(req);
      expect(res.status).not.toBe(429);
    }

    // 11th request for '9.9.9.9' proxy chain is blocked
    const reqBlock = new Request("https://kora.network/api/upload", {
      method: "POST",
      headers: {
        "x-forwarded-for": "9.9.9.9, 10.0.0.1, 10.0.0.2",
      },
    });
    const resBlock = await POST(reqBlock);
    expect(resBlock.status).toBe(429);
  });
});
