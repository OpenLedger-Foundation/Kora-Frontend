import { http, HttpResponse } from "msw";

/**
 * MSW request handlers for the invoice creation wizard tests.
 *
 * /api/upload  — handles both PDF (multipart) and metadata (JSON) uploads
 * /api/auth/*  — challenge / verify endpoints (not exercised in wizard tests
 *                but included so MSW doesn't warn on unhandled requests)
 */
export const handlers = [
  // PDF / metadata upload proxy
  http.post("/api/upload", async ({ request }) => {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // PDF upload — return a mock Pinata-style response
      return HttpResponse.json({ IpfsHash: "QmMockPdfCid1234567890abcdefghijklmnopqrstuvwxyz12" });
    }

    // JSON metadata upload — return { cid }
    return HttpResponse.json({ cid: "QmMockMetaCid1234567890abcdefghijklmnopqrstuvwxyz1" });
  }),

  // Auth challenge
  http.post("/api/auth/challenge", () =>
    HttpResponse.json({ challenge: "mock-challenge-string" })
  ),

  // Auth verify
  http.post("/api/auth/verify", () =>
    HttpResponse.json({ verified: true, expiresAt: Date.now() + 3_600_000 })
  ),
];
