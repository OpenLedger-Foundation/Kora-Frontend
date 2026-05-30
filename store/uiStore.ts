import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TxState } from "@/types";

export type Theme = "light" | "dark" | "system";

export type MaturityReminderDays = 1 | 3 | 7;

export interface NotificationPreferences {
  txConfirmed: boolean;
  invoiceFunded: boolean;
  maturityReminder: boolean;
  yieldAvailable: boolean;
  maturityReminderDays: MaturityReminderDays;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  txConfirmed: true,
  invoiceFunded: true,
  maturityReminder: true,
  yieldAvailable: true,
  maturityReminderDays: 3,
};

interface UIStore {
  walletModalOpen: boolean;
  setWalletModalOpen: (open: boolean) => void;

  // intended destination when wallet connect is required
  intendedDestination: string | null;
  setIntendedDestination: (dest: string | null) => void;

  txState: TxState;
  setTxState: (state: Partial<TxState>) => void;
  resetTxState: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  notificationPreferences: NotificationPreferences;
  setNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;
  resetNotificationPreferences: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      walletModalOpen: false,
      setWalletModalOpen: (walletModalOpen) => set({ walletModalOpen }),

      intendedDestination: null,
      setIntendedDestination: (intendedDestination) => set({ intendedDestination }),

      txState: { status: "idle" },
      setTxState: (state) =>
        set((s) => ({ txState: { ...s.txState, ...state } })),
      resetTxState: () => set({ txState: { status: "idle" } }),

      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      // default to system for best UX
      theme: "system",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const next = get().theme === "system" ? "dark" : get().theme === "dark" ? "light" : "system";
        set({ theme: next });
      },

      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      setNotificationPreferences: (prefs) =>
        set((s) => ({
          notificationPreferences: {
            ...s.notificationPreferences,
            ...prefs,
          },
        })),
      resetNotificationPreferences: () =>
        set({ notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES }),
    }),
    {
      name: "kora-ui-store",
      partialize: (state) => ({
        theme: state.theme,
        notificationPreferences: state.notificationPreferences,
      }),
    }
  )
);
