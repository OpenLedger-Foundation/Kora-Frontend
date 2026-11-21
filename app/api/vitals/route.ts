import { NextRequest, NextResponse } from "next/server";
import { logger, redact } from "@/lib/logger";
import { verifyCsrf } from "@/lib/csrf";

/**
 * POST /api/vitals
 *
 * Receives batched Web Vitals metrics from the client and stores / forwards them.
 * In a real production setup you would write these to a time-series DB, Datadog,
 * Grafana, or a custom analytics pipeline.  For now we log them server-side so
 * they appear in Vercel / server logs and return 204.
 *
 * Privacy: URLs and custom attributes are scrubbed of PII (invoice ids, emails,
 * query params, dynamic path segments) before logging or forwarding. See
 * docs/vitals-privacy.md for the redaction contract.
 */

interface VitalPayload {
  name: string;
  value: number;
  id: string;
  label: string;
  startTime: number;
  rating: "good" | "needs-improvement" | "poor";
  url: string;
  userAgent: string;
  timestamp: number;
  error?: unknown;
  context?: unknown;
}

interface VitalsBody {
  metrics: VitalPayload[];
}

// Path segments that look like identifiers (invoice ids, uuids, numeric ids,
// long hashes) are replaced so URLs cannot leak PII.
const ID_SEGMENT = /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{16,}|[A-Za-z0-9_-]{20,})$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SENSITIVE_KEYS = /(invoice|order|customer|email|phone|address|token|secret|auth|session|card|ssn|name)/i;

/**
 * Redact a URL down to its origin + static path shape. Query strings and
 * fragments are dropped entirely; dynamic path segments are collapsed to `:id`.
 */
export function redactUrl(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) return "/";
  let pathname = raw;
  try {
    const parsed = new URL(raw, "http://localhost");
    pathname = parsed.pathname;
  } catch {
    pathname = raw.split(/[?#]/)[0];
  }
  const segments = pathname.split("/").map((seg) => (ID_SEGMENT.test(seg) ? ":id" : seg));
  const redacted = segments.join("/").replace(EMAIL, ":email").slice(0, 200);
  return redacted || "/";
}

/**
 * Recursively scrub custom attributes: drop sensitive keys, redact emails in
 * strings, and cap depth/size so arbitrary client payloads cannot leak PII.
 */
export function redactAttributes(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.replace(EMAIL, ":email").slice(0, 200);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactAttributes(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(key)) continue;
      out[key] = redactAttributes(val, depth + 1);
    }
    return out;
  }
  return undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const csrfError = verifyCsrf(request);
  if (csrfError) return csrfError;

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const body: VitalsBody = await request.json();

    if (!body?.metrics || !Array.isArray(body.metrics)) {
      return NextResponse.json({ error: "Invalid payload", requestId }, { status: 400 });
    }

    // Validate and sanitise each metric
    const sanitised = body.metrics
      .filter(
        (m) =>
          typeof m.name === "string" &&
          typeof m.value === "number" &&
          typeof m.id === "string"
      )
      .map((m) => ({
        name: m.name,
        value: m.value,
        id: m.id,
        label: m.label ?? "web-vital",
        startTime: m.startTime ?? 0,
        rating: m.rating ?? "good",
        url: redactUrl(m.url),
        userAgent: typeof m.userAgent === "string" ? m.userAgent.slice(0, 200) : "",
        timestamp: m.timestamp ?? Date.now(),
        error: m.error ? redact(m.error) : undefined,
        context: m.context ? redactAttributes(m.context) : undefined,
      }));

    if (sanitised.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    const redacted = redact(sanitised) as typeof sanitised;

    // Log to server console (visible in Vercel Function logs)
    for (const metric of redacted) {
      logger.info(`Web vital report: ${metric.name}`, {
        requestId,
        route: "/api/vitals",
        metricName: metric.name,
        metricValue: metric.value,
        metricId: metric.id,
        rating: metric.rating,
        url: metric.url,
        userAgent: metric.userAgent,
        error: metric.error,
        context: metric.context,
      });
    }

    const ingestUrl = process.env.ANALYTICS_INGEST_URL;
    if (ingestUrl) {
      try {
        await fetch(ingestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
          },
          body: JSON.stringify(redacted),
        });
      } catch (err) {
        logger.error("[vitals] forward failure", { requestId, error: err });
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    logger.error("[vitals] parse error", { requestId, route: "/api/vitals", error: err });
    return NextResponse.json({ error: "Bad request", requestId }, { status: 400 });
  }
}

// Allow GET for health-check / Vercel Analytics integration
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, endpoint: "/api/vitals" });
}
