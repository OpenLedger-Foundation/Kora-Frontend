import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Notification preference types ────────────────────────────────────────────

export type NotificationChannel = "email" | "push";

export interface NotificationPreference {
  email: boolean;
  push: boolean;
}

/**
 * Granular notification categories.
 *
 * funding    — when an invoice the user owns receives a funding contribution
 * maturity   — upcoming repayment / maturity date reminders
 * repayment  — when a repayment has been processed
 * marketing  — product updates, announcements, and promotional content
 */
export type NotificationCategory = "funding" | "maturity" | "repayment" | "marketing";

export type NotificationPreferences = Record<
  NotificationCategory,
  NotificationPreference
>;

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  funding: { email: true, push: true },
  maturity: { email: true, push: true },
  repayment: { email: true, push: true },
  marketing: { email: false, push: false },
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface SettingsStore {
  /** Per-category, per-channel notification toggles */
  notifications: NotificationPreferences;

  /** Update a single channel toggle for a category */
  setNotificationPref: (
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean
  ) => void;

  /** Bulk update all preferences (e.g. "enable all") */
  setAllNotifications: (prefs: NotificationPreferences) => void;

  /** Reset to factory defaults */
  resetNotifications: () => void;

  /** Convenience: check if a specific category+channel is enabled */
  isEnabled: (
    category: NotificationCategory,
    channel: NotificationChannel
  ) => boolean;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      notifications: DEFAULT_NOTIFICATION_PREFERENCES,

      setNotificationPref: (category, channel, enabled) =>
        set((s) => ({
          notifications: {
            ...s.notifications,
            [category]: {
              ...s.notifications[category],
              [channel]: enabled,
            },
          },
        })),

      setAllNotifications: (prefs) => set({ notifications: prefs }),

      resetNotifications: () =>
        set({ notifications: DEFAULT_NOTIFICATION_PREFERENCES }),

      isEnabled: (category, channel) =>
        get().notifications[category]?.[channel] ?? false,
    }),
    {
      name: "kora-settings",
      partialize: (state) => ({ notifications: state.notifications }),
    }
  )
);
