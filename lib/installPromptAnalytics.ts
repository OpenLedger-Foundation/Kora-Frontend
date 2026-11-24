/**
 * Analytics for the PWA InstallPrompt (components/pwa/InstallPrompt.tsx).
 *
 * Tracks install/dismiss rates and segments events by cohort (SME vs
 * investor) so we can measure whether the install prompt converts
 * differently across user types. Standalone module — wire into
 * InstallPrompt's handleInstall/handleDismiss handlers when ready.
 */

export type InstallCohort = "sme" | "investor" | "unknown";

export type InstallPromptEventName =
  | "install_prompt_shown"
  | "install_prompt_accepted"
  | "install_prompt_dismissed"
  | "install_prompt_failed";

/** Coarse, non-identifying reason codes for a failed install prompt. */
export type InstallPromptFailureReason =
  | "dismissed_by_browser"
  | "not_supported"
  | "user_cancelled"
  | "unknown";

export interface InstallPromptEvent {
  name: InstallPromptEventName;
  cohort: InstallCohort;
  visitCount: number;
  timestamp: number;
  /** Only present on `install_prompt_failed`; a coarse enum, never free text. */
  reason?: InstallPromptFailureReason;
}

/**
 * Privacy guard: analytics is opt-out via `NEXT_PUBLIC_PWA_INSTALL_ANALYTICS`
 * (defaults to enabled) and always respects Do Not Track. No PII (URL, wallet
 * address, user agent, etc.) is ever attached to events.
 */
export function isInstallPromptAnalyticsEnabled(): boolean {
  try {
    const flag = process.env.NEXT_PUBLIC_PWA_INSTALL_ANALYTICS;
    if (typeof flag === "string" && /^(0|false|off|no)$/i.test(flag.trim())) {
      return false;
    }
    if (typeof navigator !== "undefined") {
      const dnt =
        (navigator as unknown as { doNotTrack?: string | null }).doNotTrack ??
        (typeof window !== "undefined"
          ? (window as unknown as { doNotTrack?: string | null }).doNotTrack
          : undefined);
      if (dnt === "1" || dnt === "yes") return false;
    }
    return true;
  } catch {
    // Fail safe: if we can't determine consent, don't send.
    return false;
  }
}

function normalizeFailureReason(reason?: string): InstallPromptFailureReason {
  switch (reason) {
    case "dismissed_by_browser":
    case "not_supported":
    case "user_cancelled":
      return reason;
    default:
      return "unknown";
  }
}

/**
 * Determines cohort from the current route. Adjust the path patterns if
 * SME/investor routing conventions differ (checked against app/dashboard
 * having both sme/ and investor-facing sections).
 */
export function detectInstallCohort(pathname: string = typeof window !== "undefined" ? window.location.pathname : ""): InstallCohort {
  if (/\/dashboard\/sme|\/sme\b/i.test(pathname)) return "sme";
  if (/\/dashboard\/investor|\/marketplace|\/investor\b/i.test(pathname)) return "investor";
  return "unknown";
}

function sendAnalyticsEvent(event: InstallPromptEvent): void {
  if (!isInstallPromptAnalyticsEnabled()) return;
  try {
    // Only coarse, non-identifying fields are ever sent.
    const props: Record<string, string | number> = {
      cohort: event.cohort,
      visit_count: event.visitCount,
    };
    if (event.reason) props.reason = event.reason;

    // Fire-and-forget to whatever analytics pipe the app already uses.
    // Falls back to a no-op if `window.gtag`/`plausible` aren't present.
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      plausible?: (...args: unknown[]) => void;
    };
    if (typeof w.gtag === "function") {
      w.gtag("event", event.name, props);
    }
    if (typeof w.plausible === "function") {
      w.plausible(event.name, { props });
    }
    // Always log locally so the metric isn't lost when no analytics SDK is loaded.
    const key = "kora-install-prompt-events";
    const raw = localStorage.getItem(key);
    const events: InstallPromptEvent[] = raw ? JSON.parse(raw) : [];
    events.push(event);
    localStorage.setItem(key, JSON.stringify(events.slice(-200)));
  } catch {
    // Analytics must never break the install flow.
  }
}

export function trackInstallPromptShown(visitCount: number): void {
  sendAnalyticsEvent({
    name: "install_prompt_shown",
    cohort: detectInstallCohort(),
    visitCount,
    timestamp: Date.now(),
  });
}

export function trackInstallPromptAccepted(visitCount: number): void {
  sendAnalyticsEvent({
    name: "install_prompt_accepted",
    cohort: detectInstallCohort(),
    visitCount,
    timestamp: Date.now(),
  });
}

export function trackInstallPromptDismissed(visitCount: number): void {
  sendAnalyticsEvent({
    name: "install_prompt_dismissed",
    cohort: detectInstallCohort(),
    visitCount,
    timestamp: Date.now(),
  });
}

export function trackInstallPromptFailed(visitCount: number, reason?: string): void {
  sendAnalyticsEvent({
    name: "install_prompt_failed",
    cohort: detectInstallCohort(),
    visitCount,
    timestamp: Date.now(),
    reason: normalizeFailureReason(reason),
  });
}

/** Reads locally-logged events back out, e.g. for a debug/analytics panel. */
export function getLocalInstallPromptEvents(): InstallPromptEvent[] {
  try {
    const raw = localStorage.getItem("kora-install-prompt-events");
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Strip any potentially identifying fields that may have been persisted
    // by older versions of this module.
    return parsed.map((entry) => {
      const e = (entry ?? {}) as Partial<InstallPromptEvent> & Record<string, unknown>;
      const clean: InstallPromptEvent = {
        name: e.name as InstallPromptEventName,
        cohort: (e.cohort as InstallCohort) ?? "unknown",
        visitCount: typeof e.visitCount === "number" ? e.visitCount : 0,
        timestamp: typeof e.timestamp === "number" ? e.timestamp : 0,
      };
      if (e.reason) clean.reason = normalizeFailureReason(e.reason as string);
      return clean;
    });
  } catch {
    return [];
  }
}
