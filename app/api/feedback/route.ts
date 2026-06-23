import { NextRequest, NextResponse } from "next/server";

export interface FeedbackPayload {
  type: "bug" | "feature" | "other";
  title: string;
  description: string;
  screenshot?: string | null; // base64 data URL
  context: {
    url: string;
    walletAddress?: string | null;
    userAgent: string;
    timestamp: string;
  };
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
  try {
    const body = (await req.json()) as FeedbackPayload;

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!body.type || !body.title?.trim() || !body.description?.trim()) {
      return NextResponse.json(
        { error: "type, title, and description are required" },
        { status: 400 }
      );
    }

    const allowed = ["bug", "feature", "other"];
    if (!allowed.includes(body.type)) {
      return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }

    // ── Console log (always) ──────────────────────────────────────────────────
    console.log("[feedback]", {
      type: body.type,
      title: body.title,
      description: body.description,
      context: body.context,
      hasScreenshot: Boolean(body.screenshot),
      ts: new Date().toISOString(),
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
        `**URL:** ${body.context.url}`,
        `**Wallet:** ${body.context.walletAddress ?? "not connected"}`,
        `**Browser:** ${body.context.userAgent}`,
        `**Submitted:** ${body.context.timestamp}`,
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
        console.error("[feedback] GitHub Issues API error:", err);
        // Don't fail the user request — log and continue
      } else {
        const issue = await ghRes.json();
        console.log("[feedback] GitHub issue created:", issue.html_url);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[feedback] error", (err as Error).message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
