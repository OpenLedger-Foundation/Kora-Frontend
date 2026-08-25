/**
 * settingsStore — persists user notification preferences via Zustand persist middleware.
 * Consistent with walletStore pattern. All notifications default to true on first load.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MaturityReminderDays = 1 | 3 | 7;
export type Persona = "investor" | "sme";

export interface NotificationPrefs {
  maturityReminder: boolean;
  fundingAlerts: boolean;
  repaymentAlerts: boolean;
  maturityReminderDays: MaturityReminderDays;
}

export interface TourSettings {
  persona: Persona;
  stepIndex: number;
  completed: boolean;
  skipped: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  maturityReminder: true,
  fundingAlerts: true,
  repaymentAlerts: true,
  maturityReminderDays: 3,
};

export const DEFAULT_TOUR_SETTINGS: TourSettings = {
  persona: "investor",
  stepIndex: 0,
  completed: false,
  skipped: false,
};

const TOUR_STORAGE_KEY = "kora-tour-done";

interface SettingsStore {
  notifications: NotificationPrefs;
  setNotifications: (prefs: Partial<NotificationPrefs>) => void;
  resetNotifications: () => void;
  tour: TourSettings;
  setTourSettings: (settings: Partial<TourSettings>) => void;
  resetTourSettings: () => void;
  restartTour: (persona?: Persona) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      notifications: DEFAULT_NOTIFICATION_PREFS,
      setNotifications: (prefs) =>
        set((s) => ({ notifications: { ...s.notifications, ...prefs } })),
      resetNotifications: () => set({ notifications: DEFAULT_NOTIFICATION_PREFS }),
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
    }
  )
);

