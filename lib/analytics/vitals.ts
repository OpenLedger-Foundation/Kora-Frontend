/**
 * Privacy-safe web vitals reporting helpers.
 *
 * Web vitals payloads frequently include page URLs and custom attributes that
 * can leak PII (invoice ids, addresses, emails, tokens, query params). These
 * helpers redact sensitive data before anything is sent to the vitals
 * endpoint (`app/api/vitals`).
 *
 * See docs/analytics-vitals-privacy.md for the redaction contract.
 */

export interface VitalsMetric {
  id?: string;
  name: string;
  value: number;
  rating?: string;
  delta?: number;
  navigationType?: string;
  entries?: unknown[];
  [key: string]: unknown;
}

export interface VitalsPayload {
  name: string;
  value: number;
  id?: string;
  rating?: string;
  delta?: number;
  navigationType?: string;
  url: string;
  attributes?: Record<string, unknown>;
}

/** Query keys whose values are always dropped. */
const SENSITIVE_QUERY_KEYS = [
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'auth',
  'authorization',
  'password',
  'passwd',
  'secret',
  'api_key',
  'apikey',
  'key',
  'session',
  'sessionid',
  'sig',
  'signature',
  'email',
  'phone',
  'ssn',
  'card',
  'cvv',
  'invoice',
  'invoice_id',
  'invoiceId',
  'order',
  'order_id',
  'orderId',
  'customer',
  'customer_id',
  'customerId',
  'account',
  'account_id',
  'accountId',
  'address',
  'redirect',
  'redirect_uri',
  'return',
  'return_to',
];

/** Attribute keys whose values are always dropped. */
const SENSITIVE_ATTRIBUTE_KEYS = [
  'email',
  'phone',
  'name',
  'fullname',
  'full_name',
  'firstname',
  'first_name',
  'lastname',
  'last_name',
  'address',
  'street',
  'city',
  'zip',
  'postal',
  'postal_code',
  'ssn',
  'dob',
  'card',
  'card_number',
  'cvv',
  'token',
  'password',
  'secret',
  'invoice',
  'invoice_id',
  'invoiceId',
  'order_id',
  'orderId',
  'customer_id',
  'customerId',
  'account_id',
  'accountId',
  'user_id',
  'userId',
  'session',
  'sessionid',
];

/** Path segments that look like identifiers (invoice ids, uuids, hashes). */
const ID_SEGMENT_PATTERNS: RegExp[] = [
  /^\d+$/, // numeric ids
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // uuid
  /^[0-9a-f]{16,}$/i, // long hex hashes
  /^(inv|ord|cus|acc|usr|txn|pay)_[A-Za-z0-9]+$/i, // prefixed ids
  /^[A-Za-z0-9_-]{20,}$/, // opaque tokens
];

const REDACTED = '[redacted]';

function isSensitiveKey(key: string, list: string[]): boolean {
  const normalized = key.toLowerCase().replace(/[-\s]/g, '_');
  return list.some((candidate) => {
    const c = candidate.toLowerCase().replace(/[-\s]/g, '_');
    return normalized === c || normalized.includes(c);
  });
}

function looksLikeId(segment: string): boolean {
  return ID_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment));
}

/**
 * Redact a URL: drop sensitive query params, strip the hash, and replace
 * identifier-like path segments with a placeholder. Origin + safe path shape
 * are preserved so vitals remain useful for aggregation.
 */
export function redactUrl(input: string | undefined | null): string {
  if (!input) return '';

  let url: URL;
  try {
    url = new URL(input, 'https://placeholder.invalid');
  } catch {
    return REDACTED;
  }

  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);

  // Redact identifier-like path segments.
  const segments = url.pathname.split('/').map((segment) => {
    if (!segment) return segment;
    return looksLikeId(segment) ? REDACTED : segment;
  });
  url.pathname = segments.join('/');

  // Drop sensitive query params, keep the rest.
  const params = url.searchParams;
  const keysToDelete: string[] = [];
  params.forEach((_value, key) => {
    if (isSensitiveKey(key, SENSITIVE_QUERY_KEYS)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => params.delete(key));

  // Never report fragments (can carry tokens).
  url.hash = '';

  if (!isAbsolute) {
    const search = url.search;
    return `${url.pathname}${search}`;
  }

  return url.toString();
}

/**
 * Redact a single custom attribute value. Sensitive keys are dropped entirely;
 * string values that look like URLs are redacted; other primitives pass through.
 */
export function redactAttribute(key: string, value: unknown): unknown {
  if (isSensitiveKey(key, SENSITIVE_ATTRIBUTE_KEYS)) {
    return REDACTED;
  }

  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
      return redactUrl(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactAttribute(key, item));
  }

  if (value && typeof value === 'object') {
    return redactAttributes(value as Record<string, unknown>);
  }

  return value;
}

/** Redact a record of custom attributes. */
export function redactAttributes(
  attributes: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!attributes) return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    result[key] = redactAttribute(key, value);
  }
  return result;
}

/**
 * Build a privacy-safe vitals payload from a raw metric. Strips `entries`
 * (which can contain full resource URLs) and redacts the page URL and any
 * custom attributes.
 */
export function sanitizeVitalsPayload(
  metric: VitalsMetric,
  pageUrl?: string,
): VitalsPayload {
  const rawUrl =
    pageUrl ??
    (typeof metric.url === 'string' ? metric.url : undefined) ??
    (typeof window !== 'undefined' ? window.location.href : '');

  const payload: VitalsPayload = {
    name: metric.name,
    value: metric.value,
    url: redactUrl(rawUrl),
  };

  if (metric.id !== undefined) payload.id = metric.id;
  if (metric.rating !== undefined) payload.rating = metric.rating;
  if (metric.delta !== undefined) payload.delta = metric.delta;
  if (metric.navigationType !== undefined) {
    payload.navigationType = metric.navigationType;
  }

  const attributes = redactAttributes(
    metric.attributes as Record<string, unknown> | undefined,
  );
  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }

  return payload;
}

/**
 * Send a sanitized vitals payload to the reporting endpoint. Never throws;
 * reporting must not break the app.
 */
export async function reportVitals(
  metric: VitalsMetric,
  endpoint = '/api/vitals',
): Promise<void> {
  if (typeof navigator === 'undefined') return;

  const payload = sanitizeVitalsPayload(metric);
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Swallow reporting errors; vitals are best-effort.
  }
}
