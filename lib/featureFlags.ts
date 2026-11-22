/**
 * Feature Flags — Issue #308
 *
 * Centralised, type-safe feature flag system backed by env vars.
 * All flags default to `false` in production. Set to `"true"` in
 * `.env.local` to enable a flag during development.
 *
 * Usage:
 *   import { isEnabled } from "@/lib/featureFlags";
 *   if (isEnabled("comparison")) { ... }
 */

import { useSyncExternalStore } from "react";

/**
 * Every feature flag supported by the app. Add new flags here.
 *
 * | Flag                      | Env var                                      | Description                                             |
 * |---------------------------|----------------------------------------------|---------------------------------------------------------|
 * | mock-data                 | NEXT_PUBLIC_ENABLE_MOCK_DATA                 | Use mock data (no live Soroban)                         |
 * | devtools                  | NEXT_PUBLIC_ENABLE_DEVTOOLS                  | Show React Query devtools                               |
 * | comparison                | NEXT_PUBLIC_ENABLE_COMPARISON                | Invoice comparison bar in marketplace                   |
 * | onboarding-tour           | NEXT_PUBLIC_ENABLE_ONBOARDING_TOUR           | Guided onboarding tour for new users                    |
 * | batch-actions             | NEXT_PUBLIC_ENABLE_BATCH_ACTIONS             | Batch cancel/repay in SME dashboard                     |
 * | kyb-mint-gate             | NEXT_PUBLIC_ENABLE_KYB_MINT_GATE             | Gate invoice minting behind KYB verification            |
 * | secondary-market          | NEXT_PUBLIC_ENABLE_SECONDARY_MARKET          | Secondary market P2P trading route                      |
 * | category-taxonomy-preview | NEXT_PUBLIC_ENABLE_CATEGORY_TAXONOMY_PREVIEW | Developer taxonomy preview panel in marketplace filters |
 * | test-components           | NEXT_PUBLIC_ENABLE_TEST_COMPONENTS           | Render isolated test harness page for component testing  |
 * | hw-wallet-signing         | NEXT_PUBLIC_ENABLE_HW_WALLET_SIGNING         | Hardware wallet signing path (Ledger/Trezor)            |
 */
export type FeatureFlag =
  | "mock-data"
  | "devtools"
  | "comparison"
  | "onboarding-tour"
  | "batch-actions"
  | "kyb-mint-gate"
  | "secondary-market"
  | "category-taxonomy-preview"
  | "test-components"
  | "hw-wallet-signing";

export const FEATURE_FLAGS: readonly FeatureFlag[] = [
  "mock-data",
  "devtools",
  "comparison",
  "onboarding-tour",
  "batch-actions",
  "kyb-mint-gate",
  "secondary-market",
  "category-taxonomy-preview",
  "test-components",
  "hw-wallet-signing",
];

export type FeatureFlagState = Record<FeatureFlag, boolean>;
export type FeatureFlagOverrides = Partial<Record<FeatureFlag, boolean>>;

/**
 * Flags whose runtime (localStorage) overrides are blocked outside
 * `NODE_ENV === "development"` — Issue #1025.
 *
 * Toggling these on a shared staging host flips the app between live and
 * demo behaviour (mock fixtures, P2P trading route), which is easy to confuse
 * during external demos. Outside local development they always resolve from
 * their env var; stored overrides are ignored on read and dropped on write.
 */
export const DISALLOWED_OVERRIDE_FLAGS: readonly FeatureFlag[] = [
  "mock-data",
  "secondary-market",
];

const FEATURE_FLAG_OVERRIDE_STORAGE_KEY = "kora:feature-flag-overrides";
const FEATURE_FLAG_CHANGE_EVENT = "kora:feature-flags-changed";

/** Maps each flag to its NEXT_PUBLIC_* env var name. */
const FLAG_ENV_MAP: Record<FeatureFlag, string> = {
  "mock-data": "NEXT_PUBLIC_ENABLE_MOCK_DATA",
  devtools: "NEXT_PUBLIC_ENABLE_DEVTOOLS",
  comparison: "NEXT_PUBLIC_ENABLE_COMPARISON",
  "onboarding-tour": "NEXT_PUBLIC_ENABLE_ONBOARDING_TOUR",
  "batch-actions": "NEXT_PUBLIC_ENABLE_BATCH_ACTIONS",
  "kyb-mint-gate": "NEXT_PUBLIC_ENABLE_KYB_MINT_GATE",
  "secondary-market": "NEXT_PUBLIC_ENABLE_SECONDARY_MARKET",
  "category-taxonomy-preview": "NEXT_PUBLIC_ENABLE_CATEGORY_TAXONOMY_PREVIEW",
  "test-components": "NEXT_PUBLIC_ENABLE_TEST_COMPONENTS",
  "hw-wallet-signing": "NEXT_PUBLIC_ENABLE_HW_WALLET_SIGNING",
};

/**
 * Public, read-only view of the flag → env var mapping.
 *
 * Exposed so the docs-parity test (Issue #1157) can assert that every runtime
 * flag is documented with the correct env var without duplicating the map.
 */
export const FEATURE_FLAG_ENV_MAP: Readonly<Record<FeatureFlag, string>> =
  FLAG_ENV_MAP;

function readEnvFlag(flag: FeatureFlag): boolean {
  const envVar = FLAG_ENV_MAP[flag];
  const val = process.env[envVar];
  if (flag === "onboarding-tour") {
    return val !== "false";
  }
  return val === "true";
}

function canUseRuntimeOverrides(): boolean {
  return typeof window !== "undefined" && process.env.NODE_ENV !== "production";
}

/**
 * Whether a runtime override may be applied to `flag` in the current build.
 * Every flag is overridable in development; DISALLOWED_OVERRIDE_FLAGS are
 * locked to their env value everywhere else (staging, test, production).
 */
export function isFlagOverrideAllowed(flag: FeatureFlag): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return !DISALLOWED_OVERRIDE_FLAGS.includes(flag);
}

function parseOverrides(raw: string | null): FeatureFlagOverrides {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const overrides: FeatureFlagOverrides = {};

    for (const flag of FEATURE_FLAGS) {
      // Ignore disallowed keys even if localStorage was edited by hand.
      if (!isFlagOverrideAllowed(flag)) continue;
      if (typeof parsed[flag] === "boolean") {
        overrides[flag] = parsed[flag];
      }
    }

    return overrides;
  } catch {
    return {};
  }
}

function readStoredOverrides(): FeatureFlagOverrides {
  if (!canUseRuntimeOverrides()) return {};
  return parseOverrides(window.localStorage.getItem(FEATURE_FLAG_OVERRIDE_STORAGE_KEY));
}

function readFeatureFlagState(): FeatureFlagState {
  const overrides = readStoredOverrides();

  return FEATURE_FLAGS.reduce<FeatureFlagState>((state, flag) => {
    state[flag] = overrides[flag] ?? readEnvFlag(flag);
    return state;
  }, {} as FeatureFlagState);
}

function emitFeatureFlagChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FEATURE_FLAG_CHANGE_EVENT));
}

function subscribeToFeatureFlags(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onStoreChange();

  window.addEventListener(FEATURE_FLAG_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(FEATURE_FLAG_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function writeOverrides(overrides: FeatureFlagOverrides): void {
  if (!canUseRuntimeOverrides()) return;

  for (const flag of Object.keys(overrides) as FeatureFlag[]) {
    if (!isFlagOverrideAllowed(flag)) delete overrides[flag];
  }

  if (Object.keys(overrides).length === 0) {
    window.localStorage.removeItem(FEATURE_FLAG_OVERRIDE_STORAGE_KEY);
  } else {
    window.localStorage.setItem(
      FEATURE_FLAG_OVERRIDE_STORAGE_KEY,
      JSON.stringify(overrides),
    );
  }

  emitFeatureFlagChange();
}

function serializeFeatureFlagState(): string {
  return JSON.stringify(readFeatureFlagState());
}

function serializeEnvFeatureFlagState(): string {
  return JSON.stringify(
    FEATURE_FLAGS.reduce<FeatureFlagState>((state, flag) => {
      state[flag] = readEnvFlag(flag);
      return state;
    }, {} as FeatureFlagState),
  );
}

/**
 * Returns `true` if the given feature flag is enabled.
 *
 * Reads the corresponding NEXT_PUBLIC_* env var at runtime.
 * Only the string `"true"` (case-sensitive) enables a flag.
 *
 * Fails safe: any read error (e.g. unavailable env / storage) resolves to
 * `false` so half-enabled paths (like HW wallet signing) never activate.
 */
export function isEnabled(flag: FeatureFlag): boolean {
  try {
    return readFeatureFlagState()[flag] === true;
  } catch {
    return false;
  }
}

export function getFeatureFlagState(): FeatureFlagState {
  return readFeatureFlagState();
}

export function getFeatureFlagOverride(
  flag: FeatureFlag,
): boolean | undefined {
  return readStoredOverrides()[flag];
}

export function setFeatureFlagOverride(
  flag: FeatureFlag,
  value: boolean | undefined,
): void {
  if (!isFlagOverrideAllowed(flag)) return;

  const overrides = readStoredOverrides();
  if (value === undefined) {
    delete overrides[flag];
  } else {
    overrides[flag] = value;
  }
  writeOverrides(overrides);
}

export function clearFeatureFlagOverrides(): void {
  writeOverrides({});
}

/**
 * React hook returning the live feature flag state.
 * Re-renders when overrides change (same tab or cross-tab).
 */
export function useFeatureFlags(): FeatureFlagState {
  const serialized = useSyncExternalStore(
    subscribeToFeatureFlags,
    serializeFeatureFlagState,
    serializeEnvFeatureFlagState,
  );
  return JSON.parse(serialized) as FeatureFlagState;
}
