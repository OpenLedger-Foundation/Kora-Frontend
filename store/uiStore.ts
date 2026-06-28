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

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
export const DEFAULT_SHORTCUTS_ENABLED = true;

interface UIStore {
  walletModalOpen: boolean;
  setWalletModalOpen: (open: boolean) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  changelogOpen: boolean;
  setChangelogOpen: (open: boolean) => void;

  // intended destination when wallet connect is required
  intendedDestination: string | null;
  setIntendedDestination: (dest: string | null) => void;

  txState: TxState;
  setTxState: (state: TxState) => void;
  resetTxState: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  notificationPreferences: NotificationPreferences;
  setNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;
  resetNotificationPreferences: () => void;

  // Keyboard shortcuts
  shortcutsEnabled: boolean;
  setShortcutsEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      walletModalOpen: false,
      setWalletModalOpen: (walletModalOpen) => set({ walletModalOpen }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

      changelogOpen: false,
      setChangelogOpen: (changelogOpen) => set({ changelogOpen }),

      intendedDestination: null,
      setIntendedDestination: (intendedDestination) => set({ intendedDestination }),

      txState: { status: "idle" },
      setTxState: (txState) => set({ txState }),
      resetTxState: () => set({ txState: { status: "idle" } }),

      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      // "system" = respect prefers-color-scheme (first-visit default, never
      // cycled back to once the user explicitly picks a preference).
      theme: "system",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        // Resolve "system" to the OS preference so we can flip it correctly,
        // then toggle between "dark" and "light" only — system is the implicit
        // default on first visit and we don't want to cycle through it again.
        const current = get().theme;
        const resolved =
          current === "system"
            ? typeof window !== "undefined" &&
              window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light"
            : current;
        set({ theme: resolved === "dark" ? "light" : "dark" });
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

      // Keyboard shortcuts
      shortcutsEnabled: DEFAULT_SHORTCUTS_ENABLED,
      setShortcutsEnabled: (shortcutsEnabled) => set({ shortcutsEnabled }),
    }),
    {
      name: "kora-ui-store",
      partialize: (state) => ({
        theme: state.theme,
        notificationPreferences: state.notificationPreferences,
        shortcutsEnabled: state.shortcutsEnabled,
      }),
    }
  )
);
