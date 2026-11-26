/**
 * Bot-challenge allowlist for health checks and uptime monitors (#1228).
 *
 * The edge challenge is opt-in: it only runs when `BOT_CHALLENGE_TOKEN` is
 * configured. When it is enabled, automated clients must send the matching
 * `x-kora-bot-token` header. Health endpoints and recognised uptime monitors
 * are allowlisted so monitoring never false-alarms.
 *
 * The allowlist is deliberately narrow about authentication: a path that is
 * auth-protected can never be bypassed by a matching user agent. Bypassing a
 * bot challenge is not the same thing as bypassing authentication, and the two
 * must never be conflated.
 */

/** Public endpoints that must always remain reachable by monitors. */
export const HEALTH_CHECK_PATHS = [
  "/api/health",
  "/api/healthz",
  "/api/status",
  "/health",
  "/healthz",
  "/ready",
  "/readyz",
  "/live",
  "/livez",
] as const;

/** User agents used by common uptime / synthetic monitoring providers. */
export const UPTIME_BOT_USER_AGENT_PATTERNS: readonly RegExp[] = [
  /uptimerobot/i,
  /pingdom/i,
  /datadog/i,
  /statuscake/i,
  /newrelic/i,
  /better ?uptime/i,
  /grafana.?cloud/i,
  /uptime\.com/i,
  /site24x7/i,
  /healthchecks\.io/i,
  /checkly/i,
  /freshping/i,
];

/** Automated clients that are challenged when the token is configured. */
export const AUTOMATED_CLIENT_USER_AGENT_PATTERNS: readonly RegExp[] = [
  /python-requests/i,
  /scrapy/i,
  /curl\//i,
  /wget\//i,
  /httpie/i,
  /go-http-client/i,
  /axios\//i,
  /node-fetch/i,
  /postmanruntime/i,
];

/**
 * Routes with their own authentication or wallet/KYB gating. A bot bypass must
 * never relax these paths — they stay behind their existing checks.
 */
export const AUTH_PROTECTED_PATH_PREFIXES = [
  "/api/auth",
  "/api/invoice",
  "/api/upload",
  "/invoice/create",
  "/dashboard",
  "/settings",
  "/transactions",
  "/analytics",
] as const;

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function matchesAny(
  value: string,
  patterns: readonly RegExp[]
): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

/** True for a health/uptime endpoint (including nested paths). */
export function isHealthCheckPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return HEALTH_CHECK_PATHS.some(
    (candidate) => path === candidate || path.startsWith(`${candidate}/`)
  );
}

/** True for routes that carry their own auth or wallet gating. */
export function isAuthProtectedPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return AUTH_PROTECTED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/** True for a recognised uptime-monitor user agent. */
export function isUptimeBotUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && matchesAny(userAgent, UPTIME_BOT_USER_AGENT_PATTERNS);
}

/** True for a generic automated client (the population we challenge). */
export function isAutomatedClientUserAgent(
  userAgent: string | null | undefined
): boolean {
  return !!userAgent && matchesAny(userAgent, AUTOMATED_CLIENT_USER_AGENT_PATTERNS);
}

export interface BotChallengeRequest {
  pathname: string;
  userAgent?: string | null;
}

/**
 * Decide whether a request is exempt from the edge bot challenge.
 *
 * Exemption is granted when either:
 *  - the path is a public health endpoint, or
 *  - the user agent belongs to a known uptime monitor.
 *
 * Auth-protected paths are always excluded from the bypass, even when the
 * request looks like a health check or comes from a monitoring provider.
 */
export function isBotChallengeBypassed(request: BotChallengeRequest): boolean {
  const { pathname, userAgent } = request;
  if (isAuthProtectedPath(pathname)) return false;
  return isHealthCheckPath(pathname) || isUptimeBotUserAgent(userAgent);
}
