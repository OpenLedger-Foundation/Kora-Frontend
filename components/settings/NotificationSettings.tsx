"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settingsStore";
import { notificationLabels } from "@/lib/i18n/notificationLabels";
import { cn } from "@/lib/utils";
import type {
  NotificationCategory,
  NotificationChannel,
} from "@/store/settingsStore";

// ─── Internal sub-components ──────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md",
          "transform transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ─── Category row ──────────────────────────────────────────────────────────────

interface CategoryRowProps {
  category: NotificationCategory;
  emailEnabled: boolean;
  pushEnabled: boolean;
  onToggle: (
    category: NotificationCategory,
    channel: NotificationChannel,
    value: boolean
  ) => void;
}

function CategoryRow({
  category,
  emailEnabled,
  pushEnabled,
  onToggle,
}: CategoryRowProps) {
  const labels = notificationLabels.categories[category];

  return (
    <div
      className="grid grid-cols-[1fr_auto_auto] items-center gap-6 py-4 border-b border-border last:border-0"
      role="row"
      aria-label={labels.title}
    >
      {/* Category info */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{labels.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {labels.description}
        </p>
      </div>

      {/* Email toggle */}
      <div className="flex flex-col items-center gap-1">
        <ToggleSwitch
          checked={emailEnabled}
          onChange={(val) => onToggle(category, "email", val)}
          ariaLabel={`${labels.title}: email notifications ${emailEnabled ? "on" : "off"}`}
        />
      </div>

      {/* Push toggle */}
      <div className="flex flex-col items-center gap-1">
        <ToggleSwitch
          checked={pushEnabled}
          onChange={(val) => onToggle(category, "push", val)}
          ariaLabel={`${labels.title}: push notifications ${pushEnabled ? "on" : "off"}`}
        />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const CATEGORIES: NotificationCategory[] = [
  "funding",
  "maturity",
  "repayment",
  "marketing",
];

/**
 * NotificationSettings
 *
 * Granular per-category, per-channel (email / push) notification preference
 * panel. Preferences are persisted via settingsStore (Zustand + localStorage).
 *
 * Maturity reminders automatically respect the push toggle for the `maturity`
 * category via useMaturityReminder.
 */
export function NotificationSettings() {
  const { notifications, setNotificationPref, resetNotifications } =
    useSettingsStore();

  const handleToggle = useCallback(
    (
      category: NotificationCategory,
      channel: NotificationChannel,
      value: boolean
    ) => {
      setNotificationPref(category, channel, value);
      toast.success(notificationLabels.savedToast, { duration: 2000 });
    },
    [setNotificationPref]
  );

  const handleReset = useCallback(() => {
    resetNotifications();
    toast.success(notificationLabels.resetToast, { duration: 2500 });
  }, [resetNotifications]);

  return (
    <section
      aria-labelledby="notification-settings-heading"
      className="rounded-xl border border-border bg-card p-6"
    >
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2
            id="notification-settings-heading"
            className="text-base font-semibold text-foreground"
          >
            {notificationLabels.pageTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {notificationLabels.pageDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className={cn(
            "shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "focus-visible:ring-offset-2 rounded"
          )}
          aria-label="Reset all notification preferences to their default values"
        >
          {notificationLabels.resetButton}
        </button>
      </div>

      {/* Column headers */}
      <div
        className="grid grid-cols-[1fr_auto_auto] items-center gap-6 pb-2 border-b border-border"
        role="row"
        aria-label="Column headers"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notification type
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center min-w-[3rem]">
          {notificationLabels.emailColumn}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center min-w-[3rem]">
          {notificationLabels.pushColumn}
        </span>
      </div>

      {/* Category rows */}
      <div role="table" aria-label="Notification preferences">
        {CATEGORIES.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            emailEnabled={notifications[category]?.email ?? false}
            pushEnabled={notifications[category]?.push ?? false}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </section>
  );
}
