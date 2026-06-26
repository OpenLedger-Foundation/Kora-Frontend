import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/vitals
 *
 * Receives batched Web Vitals metrics from the client and stores / forwards them.
 * In a real production setup you would write these to a time-series DB, Datadog,
 * Grafana, or a custom analytics pipeline.  For now we log them server-side so
 * they appear in Vercel / server logs and return 204.
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
}

interface VitalsBody {
  metrics: VitalPayload[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
        url: typeof m.url === "string" ? m.url.slice(0, 200) : "/",
        timestamp: m.timestamp ?? Date.now(),
      }));

    if (sanitised.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    // Log to server console (visible in Vercel Function logs)
    for (const metric of sanitised) {
      const ratingIcon =
        metric.rating === "good" ? "✅" : metric.rating === "needs-improvement" ? "⚠️" : "❌";
      console.log(
        `[vitals] ${ratingIcon} ${metric.name.padEnd(4)} = ${String(metric.value).padStart(6)} | ${metric.rating.padEnd(18)} | ${metric.url}`
      );
    }

    // TODO: forward to your analytics backend, e.g.:
    // await fetch(process.env.ANALYTICS_INGEST_URL, { method: "POST", body: JSON.stringify(sanitised) })

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[vitals] parse error", requestId, err);
    return NextResponse.json({ error: "Bad request", requestId }, { status: 400 });
  }
}

// Allow GET for health-check / Vercel Analytics integration
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, endpoint: "/api/vitals" });
}
