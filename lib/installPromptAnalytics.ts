/**
 * Analytics for the PWA InstallPrompt (components/pwa/InstallPrompt.tsx).
 *
 * Tracks install/dismiss rates and segments events by cohort (SME vs
 * investor) so we can measure whether the install prompt converts
 * differently across user types. Standalone module — wire into
 * InstallPrompt's handleInstall/handleDismiss handlers when ready.
 */

export type InstallCohort = "sme" | "investor" | "unknown";

/**
 * Strict allowlist of event names. Anything not listed here must never be
 * emitted — this keeps the analytics surface auditable and privacy-safe.
 */
export const INSTALL_PROMPT_EVENT_NAMES = [
  "install_prompt_shown",
  "install_prompt_accepted",
  "install_prompt_dismissed",
  "install_prompt_unavailable",
] as const;

export type InstallPromptEventName = (typeof INSTALL_PROMPT_EVENT_NAMES)[number];

/** Coarse, non-identifying outcome derived from the event name. */
export type InstallPromptOutcome = "shown" | "accepted" | "dismissed" | "unavailable";

/**
 * The ONLY fields allowed in an emitted payload. No user ids, emails, names,
 * URLs, referrers, or free-form strings — just coarse, non-identifying data.
 */
export interface InstallPromptEvent {
  name: InstallPromptEventName;
  cohort: InstallCohort;
  visitCount: number;
  timestamp: number;
  outcome: InstallPromptOutcome;
}

const MAX_LOCAL_EVENTS = 200;
const LOCAL_STORAGE_KEY = "kora-install-prompt-events";

function isAllowedEventName(name: unknown): name is InstallPromptEventName {
  return typeof name === "string" && (INSTALL_PROMPT_EVENT_NAMES as readonly string[]).includes(name);
}

function outcomeFor(name: InstallPromptEventName): InstallPromptOutcome {
  switch (name) {
    case "install_prompt_shown":
      return "shown";
    case "install_prompt_accepted":
      return "accepted";
    case "install_prompt_dismissed":
      return "dismissed";
    case "install_prompt_unavailable":
      return "unavailable";
  }
}

/**
 * Builds a sanitized payload from an event name. Only allowlisted fields are
 * copied through, so callers cannot accidentally leak PII into analytics.
 */
function buildEvent(name: InstallPromptEventName, visitCount: number): InstallPromptEvent {
  const safeVisitCount = Number.isFinite(visitCount) && visitCount >= 0 ? Math.floor(visitCount) : 0;
  return {
    name,
    cohort: detectInstallCohort(),
    visitCount: safeVisitCount,
    timestamp: Date.now(),
    outcome: outcomeFor(name),
  };
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
  // Guard against any non-allowlisted name slipping through.
  if (!isAllowedEventName(event.name)) return;

  // Only these coarse fields are ever forwarded to analytics SDKs.
  const payload = {
    cohort: event.cohort,
    visitCount: event.visitCount,
    outcome: event.outcome,
  };

  try {
    // Fire-and-forget to whatever analytics pipe the app already uses.
    // Falls back to a no-op if `window.gtag`/`plausible` aren't present.
    const w = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      plausible?: (...args: unknown[]) => void;
    };
    if (typeof w.gtag === "function") {
      w.gtag("event", event.name, payload);
    }
    if (typeof w.plausible === "function") {
      w.plausible(event.name, { props: payload });
    }
  } catch {
    // Analytics must never break the install flow.
  }

  try {
    // Always log locally so the metric isn't lost when no analytics SDK is loaded.
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const events: InstallPromptEvent[] = raw ? JSON.parse(raw) : [];
    events.push(event);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(events.slice(-MAX_LOCAL_EVENTS)));
  } catch {
    // Storage may be unavailable (private mode, quota) — never throw.
  }
}

export function trackInstallPromptShown(visitCount: number): void {
  sendAnalyticsEvent(buildEvent("install_prompt_shown", visitCount));
}

export function trackInstallPromptAccepted(visitCount: number): void {
  sendAnalyticsEvent(buildEvent("install_prompt_accepted", visitCount));
}

export function trackInstallPromptDismissed(visitCount: number): void {
  sendAnalyticsEvent(buildEvent("install_prompt_dismissed", visitCount));
}

export function trackInstallPromptUnavailable(visitCount: number): void {
  sendAnalyticsEvent(buildEvent("install_prompt_unavailable", visitCount));
}

/** Reads locally-logged events back out, e.g. for a debug/analytics panel. */
export function getLocalInstallPromptEvents(): InstallPromptEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
