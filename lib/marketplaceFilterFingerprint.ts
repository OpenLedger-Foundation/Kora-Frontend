import { DEFAULT_FILTERS, type FilterState } from "@/store/invoiceStore";

/**
 * Marketplace filter fingerprint
 * ==============================
 *
 * A fingerprint is a compact, deterministic encoding of everything that
 * changes the marketplace *result set*: the multi-select filters, the APR
 * range, the boolean toggles and the free-text search query. It is used two
 * ways:
 *
 *  1. As an equality token so the UI can tell a "different result set" from a
 *     plain re-render (see `useMarketplaceScrollReset`), and
 *  2. As a shareable string that can be encoded into a URL and decoded back
 *     into filter state (`decodeMarketplaceFilterFingerprint`).
 *
 * ### Version format
 * Every fingerprint starts with an explicit schema version so a link produced
 * by one release keeps decoding in later releases even as the payload grows.
 *
 * ```
 * v2 (current): {"v":2,"categories":[…],"jurisdictions":[…],"riskTiers":[…],
 *                "minApr":0,"maxApr":50,"activeOnly":false,"showExpired":false,
 *                "q":""}
 * v1 (legacy):  the same object *without* the leading "v" field
 * ```
 *
 * List values are trimmed, de-blanked and sorted and keys are emitted in a
 * fixed order, so one filter state always produces byte-identical output —
 * toggle order or a URL round-trip can never produce a spurious "changed"
 * signal.
 *
 * ### Backward-compatibility rules
 *  - A payload with no `v` is treated as **v1** (legacy / unversioned) and
 *    decoded when the rest of the shape is valid.
 *  - Only the versions in {@link SUPPORTED_FINGERPRINT_VERSIONS} decode.
 *  - Anything newer/unknown fails *closed*: decoding returns a structured error
 *    plus the default filter state, so a hand-edited or future link can never
 *    crash the page or corrupt live filter state.
 *  - Malformed JSON, wrong types and out-of-range numbers all fail closed with
 *    `reason` describing why.
 *
 * The sort key/direction is deliberately excluded (Issue #1015): reordering the
 * same rows should not yank the user back to the top, but adding/removing a
 * filter should.
 */

/** Current fingerprint schema version emitted by {@link buildMarketplaceFilterFingerprint}. */
export const FILTER_FINGERPRINT_VERSION = 2;

/**
 * Versions this build can decode. v1 is the historical unversioned payload;
 * v2 adds the leading `v` discriminator and reserved room for new fields.
 */
export const SUPPORTED_FINGERPRINT_VERSIONS = [1, 2] as const;

/** Why a fingerprint failed to decode — returned, never thrown. */
export type FingerprintDecodeError =
  | "empty"
  | "malformed"
  | "invalid-shape"
  | "unsupported-version";

/** Structured result of {@link decodeMarketplaceFilterFingerprint}. */
export interface DecodedFilterFingerprint {
  ok: true;
  /** Schema version detected in the payload (1 for legacy/unversioned links). */
  version: number;
  filters: FilterState;
  searchQuery: string;
}

/** Structured failure — always carries a safe fallback so callers need no guards. */
export interface FailedFilterFingerprint {
  ok: false;
  /** Detected version, or `null` when the payload could not be parsed at all. */
  version: number | null;
  reason: FingerprintDecodeError;
  /** Default filter state so the caller can recover without extra handling. */
  filters: FilterState;
  searchQuery: string;
}

export type FingerprintDecodeResult =
  | DecodedFilterFingerprint
  | FailedFilterFingerprint;

/**
 * Encode marketplace filter state into a versioned, deterministic fingerprint.
 *
 * @param filters     Current filter state.
 * @param searchQuery Free-text search query (whitespace-insensitive).
 */
export function buildMarketplaceFilterFingerprint(
  filters: FilterState,
  searchQuery = ""
): string {
  const normalise = (values: string[] | undefined) =>
    [...(values ?? [])]
      .map((value) => value.trim())
      .filter(Boolean)
      .sort();

  return JSON.stringify({
    v: FILTER_FINGERPRINT_VERSION,
    categories: normalise(filters.categories),
    jurisdictions: normalise(filters.jurisdictions),
    riskTiers: normalise(filters.riskTiers),
    minApr: filters.aprRange?.[0] ?? 0,
    maxApr: filters.aprRange?.[1] ?? 50,
    activeOnly: Boolean(filters.activeOnly),
    showExpired: Boolean(filters.showExpired),
    q: searchQuery.trim(),
  });
}

/** Parse an optional list field, tolerating `undefined` but rejecting bad types. */
function readStringList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === "string")) return null;
  return value.map((entry) => entry.trim()).filter(Boolean);
}

/** Parse an optional finite-number field, falling back when absent. */
function readNumber(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/** Parse an optional boolean field, falling back when absent. */
function readBoolean(value: unknown, fallback: boolean): boolean | null {
  if (value === undefined) return fallback;
  return typeof value === "boolean" ? value : null;
}

/**
 * Decode a fingerprint back into filter state.
 *
 * Never throws: unknown versions, malformed JSON and invalid shapes all return
 * `{ ok: false, reason, filters: DEFAULT_FILTERS, searchQuery: "" }` so callers
 * can fall back cleanly instead of crashing or half-applying bad state.
 */
export function decodeMarketplaceFilterFingerprint(
  raw: string | null | undefined
): FingerprintDecodeResult {
  const fail = (
    reason: FingerprintDecodeError,
    version: number | null = null
  ): FailedFilterFingerprint => ({
    ok: false,
    version,
    reason,
    filters: DEFAULT_FILTERS,
    searchQuery: "",
  });

  if (typeof raw !== "string" || raw.trim() === "") return fail("empty");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("malformed");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail("invalid-shape");
  }
  const payload = parsed as Record<string, unknown>;

  // No `v` → legacy (v1) payload. Anything non-integer is a malformed version.
  let version: number;
  if (payload.v === undefined) {
    version = 1;
  } else if (typeof payload.v === "number" && Number.isInteger(payload.v)) {
    version = payload.v;
  } else {
    return fail("invalid-shape");
  }

  if (!(SUPPORTED_FINGERPRINT_VERSIONS as readonly number[]).includes(version)) {
    return fail("unsupported-version", version);
  }

  const categories = readStringList(payload.categories);
  const jurisdictions = readStringList(payload.jurisdictions);
  const riskTiers = readStringList(payload.riskTiers);
  const minApr = readNumber(payload.minApr, 0);
  const maxApr = readNumber(payload.maxApr, 50);
  const activeOnly = readBoolean(payload.activeOnly, false);
  const showExpired = readBoolean(payload.showExpired, false);
  const searchQuery =
    payload.q === undefined ? "" : typeof payload.q === "string" ? payload.q : null;

  if (
    categories === null ||
    jurisdictions === null ||
    riskTiers === null ||
    minApr === null ||
    maxApr === null ||
    activeOnly === null ||
    showExpired === null ||
    searchQuery === null
  ) {
    return fail("invalid-shape", version);
  }

  if (minApr < 0 || maxApr > 50 || minApr > maxApr) {
    return fail("invalid-shape", version);
  }

  return {
    ok: true,
    version,
    filters: {
      categories,
      jurisdictions,
      riskTiers,
      aprRange: [minApr, maxApr],
      activeOnly,
      showExpired,
    },
    searchQuery,
  };
}

export default buildMarketplaceFilterFingerprint;
