/**
 * Notification preference persistence — Issue #1180.
 *
 * Every toggle must survive a rehydrate. Before the fix only three of the ten
 * keys survived, and the rest came back `undefined`, which `useToast` read as
 * "off".
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  sanitizeNotifications,
  settingsStorageKey,
  useSettingsStore,
  type NotificationPrefs,
} from "@/store/settingsStore";

const ALL_KEYS = Object.keys(DEFAULT_NOTIFICATION_PREFS) as Array<keyof NotificationPrefs>;

describe("sanitizeNotifications", () => {
  it("keeps every persisted toggle (happy path)", () => {
    const persisted: NotificationPrefs = {
      txConfirmed: false,
      invoiceFunded: false,
      yieldAvailable: false,
      maturityReminder: false,
      fundingAlerts: false,
      repaymentAlerts: false,
      maturityReminderDays: 7,
      fundingProgress: false,
      status: false,
      apr: true,
    };
    expect(sanitizeNotifications(persisted)).toEqual(persisted);
  });

  it("never returns undefined for any key, even from empty or corrupt storage", () => {
    for (const input of [undefined, null, "garbage", 42, {}]) {
      const result = sanitizeNotifications(input);
      for (const key of ALL_KEYS) {
        expect(result[key]).toBeDefined();
      }
      expect(result).toEqual(DEFAULT_NOTIFICATION_PREFS);
    }
  });

  it("replaces wrongly-typed values with defaults per key", () => {
    const result = sanitizeNotifications({
      txConfirmed: "false",
      status: 0,
      apr: true,
      maturityReminderDays: 5,
    });
    expect(result.txConfirmed).toBe(DEFAULT_NOTIFICATION_PREFS.txConfirmed);
    expect(result.status).toBe(DEFAULT_NOTIFICATION_PREFS.status);
    expect(result.apr).toBe(true);
    expect(result.maturityReminderDays).toBe(DEFAULT_NOTIFICATION_PREFS.maturityReminderDays);
  });
});

describe("useSettingsStore persistence round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ notifications: DEFAULT_NOTIFICATION_PREFS });
  });

  it("restores toast/watchlist toggles after a rehydrate", async () => {
    useSettingsStore.getState().setNotifications({ txConfirmed: false, apr: true, status: false });
    const saved = localStorage.getItem(settingsStorageKey(null));
    expect(saved).not.toBeNull();

    // Simulate a reload: reset in-memory state (setState writes through the
    // persist middleware, so put the saved payload back), then rehydrate.
    useSettingsStore.setState({ notifications: DEFAULT_NOTIFICATION_PREFS });
    localStorage.setItem(settingsStorageKey(null), saved!);
    await useSettingsStore.persist.rehydrate();

    const prefs = useSettingsStore.getState().notifications;
    expect(prefs.txConfirmed).toBe(false);
    expect(prefs.apr).toBe(true);
    expect(prefs.status).toBe(false);
    for (const key of ALL_KEYS) expect(prefs[key]).toBeDefined();
  });

  it("falls back to defaults when the stored payload is not valid JSON", async () => {
    localStorage.setItem(settingsStorageKey(null), "{not json");
    await useSettingsStore.persist.rehydrate();
    const prefs = useSettingsStore.getState().notifications;
    for (const key of ALL_KEYS) expect(prefs[key]).toBeDefined();
  });
});
