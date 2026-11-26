/**
 * settingsStore — the canonical, wallet-scoped store for persisted user settings.
 *
 * Notification preferences previously lived in three places at once
 * (`uiStore.notificationPreferences`, `invoiceStore.notificationPreferences` and
 * `settingsStore.notifications`). Each store persisted its own copy, so turning
 * a toggle off on `/settings` left the duplicate records untouched and the
 * toast/alert gates that read them kept firing — a silent preference loss.
 *
 * This store is now the single source of truth. The deprecated setter shims in
 * `uiStore`/`invoiceStore` forward here, and the legacy persisted payloads are
 * folded in once via `onRehydrateStorage` so existing users keep their choices.
 *
 * Persistence is scoped per connected wallet: the persist key rotates to
 * `kora-settings-store-${address}` (see `settingsStorageKey`) when a wallet
 * connects, so two profiles sharing a browser never read each other's
 * thresholds. The `notificationsByWallet` map keeps in-session snapshots for
 * instant switching; the per-wallet storage buckets survive reloads.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  safeStorageGetItem,
  safeStorageSetItem,
} from "./storageAdapter";

import {
  DEFAULT_CONCENTRATION_THRESHOLDS,
  SNOOZE_DURATIONS_MS,
  type ConcentrationThresholds,
  type SnoozeEntry,
} from "@/lib/concentrationRisk";
import { createPersistentJSONStorage } from "@/store/storageAdapter";

export type MaturityReminderDays = 1 | 3 | 7;
export type Persona = "investor" | "sme";

/**
 * Quiet hours for maturity reminders (#1253).
 *
 * `start`/`end` are `HH:mm` strings in the user's local wall clock, and
 * `timezone` is an IANA zone name (e.g. `Europe/Lisbon`). A window may wrap
 * midnight (`start > end`), which is the common "22:00 → 08:00" case.
 */
export interface QuietHoursSettings {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

export const DEFAULT_QUIET_HOURS: QuietHoursSettings = {
  // Off by default: enabling quiet hours silently would suppress reminders
  // users already expect, so the safe default is "no suppression".
  enabled: false,
  start: "22:00",
  end: "08:00",
  timezone: "UTC",
};

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True when `value` is a valid 24-hour `HH:mm` string. */
export function isValidQuietHoursTime(value: unknown): value is string {
  return typeof value === "string" && HH_MM_PATTERN.test(value);
}

/**
 * Resolve the browser's IANA timezone, falling back to UTC when the runtime
 * does not expose one (older Safari, some test environments).
 */
export function detectQuietHoursTimezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone.length > 0 ? zone : "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Validate an IANA timezone name. Unknown zones fall back to UTC so a stale or
 * hand-edited value cannot make the quiet-hours check throw.
 */
export function sanitizeQuietHoursTimezone(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) return "UTC";
  const candidate = value.trim();
  try {
    // Throws a RangeError for unknown zones.
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

/** Coerce an arbitrary persisted value into a complete quiet-hours slice. */
export function sanitizeQuietHours(
  value: unknown,
  fallback: QuietHoursSettings = DEFAULT_QUIET_HOURS,
): QuietHoursSettings {
  const raw =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    start: isValidQuietHoursTime(raw.start) ? raw.start : fallback.start,
    end: isValidQuietHoursTime(raw.end) ? raw.end : fallback.end,
    timezone: sanitizeQuietHoursTimezone(raw.timezone ?? fallback.timezone),
  };
}

/**
 * The union of every notification toggle the app exposes. Keys keep the names
 * their original stores used so call sites and persisted payloads map across
 * without translation.
 */
export interface NotificationPrefs {
  // Transaction lifecycle toasts (was `uiStore.notificationPreferences`).
  txConfirmed: boolean;
  invoiceFunded: boolean;
  yieldAvailable: boolean;
  // Settings surface + contract-event milestone alerts.
  maturityReminder: boolean;
  fundingAlerts: boolean;
  repaymentAlerts: boolean;
  maturityReminderDays: MaturityReminderDays;
  // Watchlist alerts (was `invoiceStore.notificationPreferences`).
  fundingProgress: boolean;
  status: boolean;
  apr: boolean;
}

export interface TourSettings {
  persona: Persona;
  stepIndex: number;
  completed: boolean;
  skipped: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  txConfirmed: true,
  invoiceFunded: true,
  yieldAvailable: true,
  maturityReminder: true,
  fundingAlerts: true,
  repaymentAlerts: true,
  maturityReminderDays: 3,
  fundingProgress: true,
  status: true,
  apr: false,
};

export const DEFAULT_TOUR_SETTINGS: TourSettings = {
  persona: "investor",
  stepIndex: 0,
  completed: false,
  skipped: false,
};

const TOUR_STORAGE_KEY = "kora-tour-done";

// ── Per-wallet persistence keying ────────────────────────────────────────────

/**
 * Base persist key. When a wallet is connected the key becomes
 * `kora-settings-store-${normalizedAddress}` so notification/tour/concentration
 * settings never bleed between profiles on a shared browser.
 */
export const SETTINGS_STORAGE_BASE_KEY = "kora-settings-store";

/**
 * Normalise a wallet address for use as a storage-key suffix. Stellar
 * addresses are uppercase base32, but pasted/derived values may arrive in
 * lowercase; casing them consistently stops the same wallet from producing two
 * buckets (the "address case sensitivity" edge case).
 */
export function normalizeSettingsWalletAddress(
  address?: string | null
): string | null {
  const trimmed = address?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

/**
 * Storage key for a wallet (or the disconnected bucket when `address` is
 * nullish). Exported so tests and consumers share one definition.
 */
export function settingsStorageKey(address?: string | null): string {
  const normalized = normalizeSettingsWalletAddress(address);
  return normalized
    ? `${SETTINGS_STORAGE_BASE_KEY}-${normalized}`
    : SETTINGS_STORAGE_BASE_KEY;
}

/** The subset of store state that is persisted per wallet (see `partialize`). */
interface PersistedWalletSettings {
  notifications?: NotificationPrefs;
  tour?: TourSettings;
  concentration?: ConcentrationSettings;
  quietHours?: QuietHoursSettings;
  notificationsMigrated?: boolean;
}

/**
 * Read a wallet's persisted settings straight from storage without triggering a
 * rehydrate. Used by `setActiveWallet` to load the incoming bucket before the
 * state write, so switching wallets cannot overwrite the bucket it is reading.
 * Returns `null` when the wallet has never persisted anything.
 */
export function readPersistedWalletSettings(
  address: string,
  readItem: (key: string) => string | null = safeStorageGetItem
): PersistedWalletSettings | null {
  const raw = readItem(settingsStorageKey(address));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: PersistedWalletSettings };
    return parsed?.state ?? null;
  } catch {
    return null;
  }
}

// ── Legacy notification preference migration ─────────────────────────────────

export const LEGACY_UI_STORE_KEY = "kora-ui-store";
export const LEGACY_INVOICE_STORE_KEY = "kora-invoice-store";

type StorageReader = (key: string) => string | null;
type StorageWriter = (key: string, value: string) => void;

const LEGACY_BOOLEAN_KEYS: Array<Exclude<keyof NotificationPrefs, "maturityReminderDays">> = [
  "txConfirmed",
  "invoiceFunded",
  "yieldAvailable",
  "maturityReminder",
  "fundingAlerts",
  "repaymentAlerts",
  "fundingProgress",
  "status",
  "apr",
];

function extractLegacyPrefs(legacy: Record<string, unknown>): Partial<NotificationPrefs> {
  const prefs: Partial<NotificationPrefs> = {};
  for (const key of LEGACY_BOOLEAN_KEYS) {
    if (typeof legacy[key] === "boolean") {
      prefs[key] = legacy[key] as boolean;
    }
  }
  const days = legacy.maturityReminderDays;
  if (days === 1 || days === 3 || days === 7) {
    prefs.maturityReminderDays = days;
  }
  return prefs;
}

function readLegacyPrefs(raw: string | null): Partial<NotificationPrefs> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const legacy = parsed?.state?.notificationPreferences;
    if (!legacy || typeof legacy !== "object") return null;
    return extractLegacyPrefs(legacy as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Fold the notification preferences out of the legacy `uiStore`/`invoiceStore`
 * persisted payloads into a single canonical partial, and strip the duplicated
 * field from those payloads so the two copies cannot drift again.
 *
 * Pure with respect to the injected storage so it can be tested without
 * touching the real `localStorage`.
 */
export function migrateLegacyNotificationPreferences(
  readItem: StorageReader = safeStorageGetItem,
  writeItem: StorageWriter = safeStorageSetItem
): { prefs: Partial<NotificationPrefs>; migrated: boolean } {
  const prefs: Partial<NotificationPrefs> = {};
  let migrated = false;

  for (const key of [LEGACY_UI_STORE_KEY, LEGACY_INVOICE_STORE_KEY]) {
    const raw = readItem(key);
    const legacy = readLegacyPrefs(raw);
    if (!raw || !legacy || Object.keys(legacy).length === 0) continue;

    // First writer wins so `uiStore` (the newer surface) takes precedence.
    for (const field of LEGACY_BOOLEAN_KEYS) {
      const value = legacy[field];
      if (prefs[field] === undefined && value !== undefined) {
        prefs[field] = value;
      }
    }
    if (
      prefs.maturityReminderDays === undefined &&
      legacy.maturityReminderDays !== undefined
    ) {
      prefs.maturityReminderDays = legacy.maturityReminderDays;
    }
    migrated = true;

    // Remove the duplicated field from the legacy payload; if it cannot be
    // rewritten the migration still completed, and the marker stops a re-run.
    try {
      const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
      if (parsed?.state && "notificationPreferences" in parsed.state) {
        delete parsed.state.notificationPreferences;
        writeItem(key, JSON.stringify(parsed));
      }
    } catch {
      // Leave the legacy key untouched when it is not valid JSON.
    }
  }

  return { prefs, migrated };
}

/**
 * Concentration alert state (issue #604).
 *
 * Dismissals and snoozes are keyed by `dimension:bucket`, not by percentage, so
 * a dismissal survives the number moving. Otherwise every recomputation would
 * resurrect an alert the investor had already acknowledged.
 */
export interface ConcentrationSettings {
  thresholds: ConcentrationThresholds;
  dismissedKeys: string[];
  snoozes: SnoozeEntry[];
}

export const DEFAULT_CONCENTRATION_SETTINGS: ConcentrationSettings = {
  thresholds: DEFAULT_CONCENTRATION_THRESHOLDS,
  dismissedKeys: [],
  snoozes: [],
};

/**
 * Storage schema version (#1125).
 *
 * v0 wrote whatever was in memory with no validation, so a partial write, an
 * older shape, or a hand-edited entry could put `stepIndex: "3"` or
 * `persona: "admin"` into the tour state and strand the onboarding flow.
 */
export const SETTINGS_STORAGE_VERSION = 1;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Validate every notification toggle (#1180). Previously only the three
 * settings-page toggles survived rehydrate, so `txConfirmed`, `invoiceFunded`,
 * `yieldAvailable`, `fundingProgress`, `status` and `apr` came back
 * `undefined` after a reload — the toast gate in `useToast` read that as
 * "off" and silently stopped notifying. Each key now keeps its persisted
 * boolean or falls back to its default; nothing is dropped.
 */
export function sanitizeNotifications(
  value: unknown,
  fallback: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS,
): NotificationPrefs {
  const raw = asRecord(value);
  const days = raw.maturityReminderDays;
  const prefs = { ...fallback };
  for (const key of LEGACY_BOOLEAN_KEYS) {
    if (typeof raw[key] === "boolean") prefs[key] = raw[key] as boolean;
  }
  prefs.maturityReminderDays =
    days === 1 || days === 3 || days === 7 ? days : fallback.maturityReminderDays;
  return prefs;
}

/**
 * The tour slice is the one that has to survive a refresh intact: `stepIndex`
 * is what resumes the tour where the user left it (#1125), so it is coerced
 * back to a safe integer rather than trusted.
 */
function sanitizeTour(value: unknown, fallback: TourSettings): TourSettings {
  const raw = asRecord(value);
  const stepIndex =
    typeof raw.stepIndex === "number" && Number.isFinite(raw.stepIndex)
      ? Math.max(0, Math.floor(raw.stepIndex))
      : fallback.stepIndex;
  return {
    persona: raw.persona === "sme" ? "sme" : "investor",
    stepIndex,
    completed: raw.completed === true,
    skipped: raw.skipped === true,
  };
}

function sanitizeConcentration(
  value: unknown,
  fallback: ConcentrationSettings,
): ConcentrationSettings {
  const raw = asRecord(value);
  const rawThresholds = asRecord(raw.thresholds);
  const thresholds: ConcentrationThresholds = { ...fallback.thresholds };
  for (const key of Object.keys(thresholds) as Array<keyof ConcentrationThresholds>) {
    const candidate = rawThresholds[key];
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      thresholds[key] = candidate;
    }
  }

  const dismissedKeys = Array.isArray(raw.dismissedKeys)
    ? raw.dismissedKeys.filter((key): key is string => typeof key === "string")
    : [];

  const snoozes: SnoozeEntry[] = Array.isArray(raw.snoozes)
    ? raw.snoozes.filter((entry): entry is SnoozeEntry => {
        if (entry === null || typeof entry !== "object") return false;
        const { key, until } = entry as { key?: unknown; until?: unknown };
        return (
          typeof key === "string" &&
          typeof until === "number" &&
          Number.isFinite(until) &&
          until > Date.now()
        );
      })
    : [];

  return { thresholds, dismissedKeys, snoozes };
}

/** Normalize whatever was read from storage into a complete settings slice. */
export function sanitizeSettings(value: unknown): Pick<
  SettingsStore,
  "notifications" | "tour" | "concentration" | "quietHours"
> {
  const raw = asRecord(value);
  return {
    notifications: sanitizeNotifications(raw.notifications, DEFAULT_NOTIFICATION_PREFS),
    tour: sanitizeTour(raw.tour, DEFAULT_TOUR_SETTINGS),
    concentration: sanitizeConcentration(
      raw.concentration,
      DEFAULT_CONCENTRATION_SETTINGS,
    ),
    quietHours: sanitizeQuietHours(raw.quietHours, DEFAULT_QUIET_HOURS),
  };
}

interface SettingsStore {
  notifications: NotificationPrefs;
  /** Per-wallet notification preferences, keyed by wallet address. */
  notificationsByWallet: Record<string, NotificationPrefs>;
  /** Wallet whose preferences are currently loaded into `notifications`. */
  activeWallet: string | null;
  /** Latches the one-time legacy-preference migration. */
  notificationsMigrated: boolean;
  setActiveWallet: (address: string | null) => void;
  setNotifications: (prefs: Partial<NotificationPrefs>) => void;
  resetNotifications: () => void;
  tour: TourSettings;
  setTourSettings: (settings: Partial<TourSettings>) => void;
  resetTourSettings: () => void;
  restartTour: (persona?: Persona) => void;
  quietHours: QuietHoursSettings;
  setQuietHours: (settings: Partial<QuietHoursSettings>) => void;
  resetQuietHours: () => void;
  concentration: ConcentrationSettings;
  setConcentrationThresholds: (thresholds: Partial<ConcentrationThresholds>) => void;
  dismissConcentrationAlert: (key: string) => void;
  snoozeConcentrationAlert: (key: string, durationMs?: number) => void;
  resetConcentrationAlerts: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      notifications: DEFAULT_NOTIFICATION_PREFS,
      notificationsByWallet: {},
      activeWallet: null,
      notificationsMigrated: false,

      /**
       * Switch the wallet whose preferences are live. The outgoing wallet's
       * current preferences are snapshotted before the incoming wallet's are
       * loaded, so switching wallets never loses edits and never leaks one
       * wallet's choices into another. The first wallet to connect adopts the
       * already-loaded preferences, so connecting does not reset a user who had
       * configured things before scoping existed.
       *
       * The persist key rotates to the incoming wallet's bucket. Its stored
       * settings (if any) are read *before* the state write so the write cannot
       * clobber the bucket with the outgoing wallet's values — the write simply
       * echoes back what was just read.
       */
      setActiveWallet: (address) => {
        const current = useSettingsStore.getState();
        const next = normalizeSettingsWalletAddress(address);
        // Disconnecting keeps the last wallet's preferences loaded, so a
        // simple reconnect is a no-op rather than a reset to defaults.
        if (!next || next === current.activeWallet) return;

        const byWallet = current.activeWallet
          ? {
              ...current.notificationsByWallet,
              [current.activeWallet]: current.notifications,
            }
          : { ...current.notificationsByWallet };

        const stored = readPersistedWalletSettings(next);

        useSettingsStore.persist.setOptions({
          name: settingsStorageKey(next),
        });

        if (stored) {
          // Stored buckets may predate a toggle or be partially written, so
          // validate them the same way rehydrate does (#1180).
          const storedNotifications = stored.notifications
            ? sanitizeNotifications(stored.notifications)
            : undefined;
          useSettingsStore.setState({
            activeWallet: next,
            notifications: storedNotifications ?? current.notifications,
            tour: stored.tour ?? current.tour,
            concentration: stored.concentration ?? current.concentration,
            quietHours: stored.quietHours ?? current.quietHours,
            notificationsMigrated:
              stored.notificationsMigrated ?? current.notificationsMigrated,
            notificationsByWallet: storedNotifications
              ? { ...byWallet, [next]: storedNotifications }
              : byWallet,
          });
          return;
        }

        const notifications =
          byWallet[next] ??
          (current.activeWallet === null
            ? current.notifications
            : DEFAULT_NOTIFICATION_PREFS);

        useSettingsStore.setState({
          activeWallet: next,
          notificationsByWallet: { ...byWallet, [next]: notifications },
          notifications,
        });
      },

      setNotifications: (prefs) =>
        set((s) => {
          const notifications = { ...s.notifications, ...prefs };
          return {
            notifications,
            notificationsByWallet: s.activeWallet
              ? { ...s.notificationsByWallet, [s.activeWallet]: notifications }
              : s.notificationsByWallet,
          };
        }),

      resetNotifications: () =>
        set((s) => ({
          notifications: DEFAULT_NOTIFICATION_PREFS,
          notificationsByWallet: s.activeWallet
            ? { ...s.notificationsByWallet, [s.activeWallet]: DEFAULT_NOTIFICATION_PREFS }
            : s.notificationsByWallet,
        })),

      tour: DEFAULT_TOUR_SETTINGS,
      setTourSettings: (settings) =>
        set((s) => {
          const nextTour = { ...s.tour, ...settings };
          if (typeof window !== "undefined") {
            if (nextTour.completed || nextTour.skipped) {
              try {
                localStorage.setItem(TOUR_STORAGE_KEY, "true");
              } catch {
                // storage unavailable
              }
            }
          }
          return { tour: nextTour };
        }),
      resetTourSettings: () => {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(TOUR_STORAGE_KEY);
          } catch {
            // storage unavailable
          }
        }
        set({ tour: DEFAULT_TOUR_SETTINGS });
      },
      quietHours: DEFAULT_QUIET_HOURS,
      setQuietHours: (settings) =>
        set((s) => ({
          quietHours: sanitizeQuietHours(
            { ...s.quietHours, ...settings },
            s.quietHours,
          ),
        })),
      resetQuietHours: () => set({ quietHours: DEFAULT_QUIET_HOURS }),
      concentration: DEFAULT_CONCENTRATION_SETTINGS,
      setConcentrationThresholds: (thresholds) =>
        set((s) => ({
          concentration: {
            ...s.concentration,
            thresholds: { ...s.concentration.thresholds, ...thresholds },
          },
        })),
      dismissConcentrationAlert: (key) =>
        set((s) => ({
          concentration: {
            ...s.concentration,
            dismissedKeys: s.concentration.dismissedKeys.includes(key)
              ? s.concentration.dismissedKeys
              : [...s.concentration.dismissedKeys, key],
          },
        })),
      snoozeConcentrationAlert: (key, durationMs = SNOOZE_DURATIONS_MS.day) =>
        set((s) => ({
          concentration: {
            ...s.concentration,
            // Replace any existing snooze for this key rather than stacking, so
            // snoozing twice does not silently double the delay.
            snoozes: [
              ...s.concentration.snoozes.filter((entry) => entry.key !== key),
              { key, until: Date.now() + durationMs },
            ],
          },
        })),
      resetConcentrationAlerts: () =>
        set((s) => ({
          concentration: { ...s.concentration, dismissedKeys: [], snoozes: [] },
        })),
      restartTour: (persona) => {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(TOUR_STORAGE_KEY);
          } catch {
            // storage unavailable
          }
        }
        set((s) => ({
          tour: {
            persona: persona ?? s.tour.persona,
            stepIndex: 0,
            completed: false,
            skipped: false,
          },
        }));
      },
    }),
    {
      name: "kora-settings-store",
      // Safe storage with an in-memory fallback (#1125): a blocked or full
      // localStorage must not break settings, and writes must be JSON.
      storage: createPersistentJSONStorage(),
      version: SETTINGS_STORAGE_VERSION,
      // v0 → v1: same slices, but validated instead of trusted.
      migrate: (persisted) => sanitizeSettings(persisted),
      // Always run on rehydrate (same version too): fills any slice that is
      // missing and drops fields that do not belong, without touching actions.
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSettings(persisted),
      }),
      name: settingsStorageKey(null),
      /**
       * Persist only the user-facing settings. `activeWallet` and
       * `notificationsByWallet` are session state — the per-wallet buckets are
       * the durable store, and writing the cross-wallet snapshot map into the
       * (shared) disconnected bucket would leave another profile's preferences
       * on disk for the next user of the browser.
       */
      partialize: (state) => ({
        notifications: state.notifications,
        tour: state.tour,
        concentration: state.concentration,
        quietHours: state.quietHours,
        notificationsMigrated: state.notificationsMigrated,
      }),
      /**
       * One-time migration: pull the diverged notification preferences out of
       * the legacy `uiStore`/`invoiceStore` payloads the first time this store
       * rehydrates, then latch the marker so it never runs twice.
       */
      onRehydrateStorage: () => (state, error) => {
        if (error || !state || state.notificationsMigrated) return;
        const { prefs } = migrateLegacyNotificationPreferences();
        useSettingsStore.setState((current) => ({
          notifications: { ...current.notifications, ...prefs },
          notificationsByWallet: current.activeWallet
            ? {
                ...current.notificationsByWallet,
                [current.activeWallet]: { ...current.notifications, ...prefs },
              }
            : current.notificationsByWallet,
          notificationsMigrated: true,
        }));
      },
    }
  )
);
