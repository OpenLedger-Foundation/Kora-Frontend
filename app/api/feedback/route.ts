import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyCsrf } from "@/lib/csrf";
import { sanitizeInput } from "@/lib/security";

export interface FeedbackPayload {
  type: "bug" | "feature" | "other";
  title: string;
  description: string;
  screenshot?: string | null; // base64 data URL
  context?: {
    url: string;
    walletAddress?: string | null;
    userAgent: string;
    timestamp: string;
  };
}

// Limits mirror the FeedbackWidget client schema (components/feedback/FeedbackWidget.tsx).
const FEEDBACK_TYPES: FeedbackPayload["type"][] = ["bug", "feature", "other"];
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CONTEXT_FIELD_LENGTH = 2048;

const ALLOWED_KEYS = new Set(["type", "title", "description", "screenshot", "context"]);
const CONTEXT_KEYS = new Set(["url", "walletAddress", "userAgent", "timestamp"]);

// ── Rate limiting (Issue #1265) ─────────────────────────────────────────────
// Lightweight in-memory limiter keyed by wallet address (when present) or IP.
// Defaults: 5 submissions per 10 minutes. Override via env if needed.
const RATE_LIMIT_MAX = Number(process.env.FEEDBACK_RATE_LIMIT_MAX ?? 5);
const RATE_LIMIT_WINDOW_MS = Number(process.env.FEEDBACK_RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientKey(req: NextRequest, walletAddress?: string | null): string {
  if (walletAddress) return `wallet:${walletAddress.toLowerCase()}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

/**
 * Returns the number of seconds to wait if the key is over the limit,
 * otherwise records the hit and returns 0.
 */
function checkRateLimit(key: string): number {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return 0;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  }

  entry.count += 1;
  return 0;
}

function rateLimitedResponse(requestId: string, retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many feedback submissions. Please try again later.", requestId, retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/**
 * Like sanitizeInput, but keeps line breaks and tabs so multi-line
 * descriptions survive. Emoji and other non-ASCII text are preserved.
 */
function sanitizeMultiline(value: string, maxLength: number): string {
  return value
    .replace(/<[^>]*>/g, "") // strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // control chars except \t \n \r
    .slice(0, maxLength)
    .trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reject JSON shapes the FeedbackWidget never sends: non-object bodies,
 * unknown keys, and non-string field values. Returns an error message or null.
 */
function validateFeedbackShape(raw: unknown): string | null {
  if (!isPlainObject(raw)) return "Request body must be a JSON object";

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) return `Unexpected field: ${key}`;
  }

  for (const key of ["type", "title", "description"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      return `${key} must be a string`;
    }
  }

  if (raw.screenshot !== undefined && raw.screenshot !== null && typeof raw.screenshot !== "string") {
    return "screenshot must be a string or null";
  }

  if (raw.context !== undefined) {
    if (!isPlainObject(raw.context)) return "context must be an object";
    for (const [key, value] of Object.entries(raw.context)) {
      if (!CONTEXT_KEYS.has(key)) return `Unexpected context field: ${key}`;
      if (key === "walletAddress" && value === null) continue;
      if (typeof value !== "string") return `context.${key} must be a string`;
      if (value.length > MAX_CONTEXT_FIELD_LENGTH) return `context.${key} is too long`;
    }
  }

  return null;
}

/**
 * POST /api/feedback
 * Accepts a feedback submission, logs it to the console, and optionally
 * forwards it to the GitHub Issues API when GITHUB_FEEDBACK_TOKEN and
 * GITHUB_FEEDBACK_REPO are set in the environment.
 *
 * GITHUB_FEEDBACK_REPO format: "owner/repo"
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const csrfError = verifyCsrf(req);
  if (csrfError) return csrfError;

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
  }

  try {
    const shapeError = validateFeedbackShape(raw);
    if (shapeError) {
      return NextResponse.json({ error: shapeError, requestId }, { status: 400 });
    }
    const input = raw as FeedbackPayload;

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!input.type || !input.title?.trim() || !input.description?.trim()) {
      return NextResponse.json(
        { error: "type, title, and description are required", requestId },
        { status: 400 }
      );
    }

    if (!FEEDBACK_TYPES.includes(input.type)) {
      return NextResponse.json({ error: "Invalid feedback type", requestId }, { status: 400 });
    }

    if (input.title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `title must be at most ${MAX_TITLE_LENGTH} characters`, requestId },
        { status: 400 }
      );
    }

    if (input.description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`, requestId },
        { status: 400 }
      );
    }

    // ── Sanitization: strip HTML tags and control characters ────────────────
    const body: FeedbackPayload = {
      ...input,
      title: sanitizeInput(input.title, MAX_TITLE_LENGTH),
      description: sanitizeMultiline(input.description, MAX_DESCRIPTION_LENGTH),
    };
    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: "type, title, and description are required", requestId },
        { status: 400 }
      );
    }

    // ── Rate limiting (Issue #1265) ──────────────────────────────────────────
    const clientKey = getClientKey(req, body.context?.walletAddress);
    const retryAfterSeconds = checkRateLimit(clientKey);
    if (retryAfterSeconds > 0) {
      logger.warn("Feedback rate limit exceeded", {
        requestId,
        route: "/api/feedback",
        retryAfterSeconds,
      });
      return rateLimitedResponse(requestId, retryAfterSeconds);
    }

    // ── Screenshot validation (Issue #959) ────────────────────────────────
    const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024; // 2 MiB
    const ALLOWED_SCREENSHOT_MIME = ["image/png", "image/jpeg", "image/webp"];
    if (body.screenshot) {
      const mimeMatch = body.screenshot.match(/^data:([^/]+\/[^;]+);/);
      const mime = mimeMatch?.[1];
      if (!mime || !ALLOWED_SCREENSHOT_MIME.includes(mime)) {
        return NextResponse.json(
          { error: "Screenshot must be a PNG, JPEG or WEBP image", requestId },
          { status: 400 }
        );
      }
      const base64 = body.screenshot.split(",")[1] ?? "";
      const approxBytes = Math.floor((base64.length * 3) / 4);
      if (approxBytes > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json(
          { error: "Screenshot exceeds the 2 MiB size limit", requestId },
          { status: 400 }
        );
      }
    }

    // ── Console log (always) ──────────────────────────────────────────────────
    logger.info("Feedback received", {
      requestId,
      route: "/api/feedback",
      feedbackType: body.type,
      title: body.title,
      description: body.description,
      context: body.context,
      hasScreenshot: Boolean(body.screenshot),
    });

    // ── Optional: GitHub Issues API ───────────────────────────────────────────
    const ghToken = process.env.GITHUB_FEEDBACK_TOKEN;
    const ghRepo = process.env.GITHUB_FEEDBACK_REPO; // e.g. "org/kora-frontend"

    if (ghToken && ghRepo) {
      const labelMap: Record<FeedbackPayload["type"], string> = {
        bug: "bug",
        feature: "enhancement",
        other: "feedback",
      };

      const issueBody = [
        `**Type:** ${body.type}`,
        `**URL:** ${body.context?.url ?? "unknown"}`,
        `**Wallet:** ${body.context?.walletAddress ?? "not connected"}`,
        `**Browser:** ${body.context?.userAgent ?? "unknown"}`,
        `**Submitted:** ${body.context?.timestamp ?? "unknown"}`,
        "",
        "## Description",
        body.description,
        body.screenshot
          ? "\n> _Screenshot attached (base64 omitted from issue body)_"
          : "",
      ]
        .filter((l) => l !== undefined)
        .join("\n");

      const ghRes = await fetch(`https://api.github.com/repos/${ghRepo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: `[${body.type.toUpperCase()}] ${body.title}`,
          body: issueBody,
          labels: [labelMap[body.type]],
        }),
      });

      if (!ghRes.ok) {
        const err = await ghRes.text();
        logger.error("GitHub Issues API error", {
          requestId,
          route: "/api/feedback",
          status: ghRes.status,
          error: err,
        });
        // Surface upstream rate limiting so the client can back off gracefully.
        if (ghRes.status === 429) {
          const retryAfterHeader = Number(ghRes.headers.get("retry-after"));
          const upstreamRetry =
            Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : 60;
          return rateLimitedResponse(requestId, upstreamRetry);
        }
        // Other upstream failures: don't fail the user request — log and continue
      } else {
        const issue = await ghRes.json();
        logger.info("GitHub issue created", { requestId, route: "/api/feedback", issueUrl: issue.html_url });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("Feedback submission error", { requestId, route: "/api/feedback", error: err });
    return NextResponse.json({ error: "Server error", requestId }, { status: 500 });
  }
}

/** Test-only helper to reset the in-memory rate limiter between cases. */
export function __resetFeedbackRateLimit(): void {
  rateLimitStore.clear();
}
