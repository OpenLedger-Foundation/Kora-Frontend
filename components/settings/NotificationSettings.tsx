"use client";

import { Compass, Keyboard, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/store/uiStore";
import { useSettingsStore, type MaturityReminderDays, type Persona } from "@/store/settingsStore";
import { Button } from "@/components/ui/button";

const NOTIFICATION_ITEMS: Array<{
  key: "maturityReminder" | "fundingAlerts" | "repaymentAlerts";
  labelKey: string;
  descEnabledKey: string;
  descDisabledKey: string;
}> = [
  {
    key: "maturityReminder",
    labelKey: "maturityReminder.label",
    descEnabledKey: "maturityReminder.descEnabled",
    descDisabledKey: "maturityReminder.descDisabled",
  },
  {
    key: "fundingAlerts",
    labelKey: "fundingAlerts.label",
    descEnabledKey: "fundingAlerts.descEnabled",
    descDisabledKey: "fundingAlerts.descDisabled",
  },
  {
    key: "repaymentAlerts",
    labelKey: "repaymentAlerts.label",
    descEnabledKey: "repaymentAlerts.descEnabled",
    descDisabledKey: "repaymentAlerts.descDisabled",
  },
];

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

export function NotificationSettings() {
  const tOnboarding = useTranslations("onboarding");
  const tSettings = useTranslations("settings");
  const { notifications, setNotifications, resetNotifications, tour, setTourSettings, restartTour } = useSettingsStore();
  const shortcutsEnabled = useUIStore((s) => s.shortcutsEnabled);
  const setShortcutsEnabled = useUIStore((s) => s.setShortcutsEnabled);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{tSettings("title")}</h3>
        <p className="text-sm text-muted-foreground">{tSettings("description")}</p>
      </div>

      <div className="space-y-3">
        {NOTIFICATION_ITEMS.map((item) => {
          const isChecked = notifications[item.key];
          return (
            <div key={item.key} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{tSettings(item.labelKey)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isChecked ? tSettings(item.descEnabledKey) : tSettings(item.descDisabledKey)}
                </p>
              </div>
              <Toggle
                checked={isChecked}
                onChange={(next) => setNotifications({ [item.key]: next })}
                ariaLabel={`Toggle ${tSettings(item.labelKey)}`}
              />
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <label htmlFor="maturity-reminder-days" className="block text-sm font-medium text-foreground">
          {tSettings("timing.label")}
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {notifications.maturityReminder ? tSettings("timing.descEnabled") : tSettings("timing.descDisabled")}
        </p>
        <select
          id="maturity-reminder-days"
          value={notifications.maturityReminderDays}
          onChange={(e) => setNotifications({ maturityReminderDays: Number(e.target.value) as MaturityReminderDays })}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={!notifications.maturityReminder}
        >
          <option value={1}>{tSettings("timing.oneDay")}</option>
          <option value={3}>{tSettings("timing.threeDays")}</option>
          <option value={7}>{tSettings("timing.sevenDays")}</option>
        </select>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
        onClick={resetNotifications}
      >
        {tSettings("resetDefaults")}
      </Button>

      {/* ── Onboarding Tour Settings ────────────────────────────────────── */}
      <div className="space-y-1 pt-2">
        <h3 className="text-base font-semibold text-foreground">{tOnboarding("skipLabel")}</h3>
        <p className="text-sm text-muted-foreground">
          {tOnboarding("restartTourDesc")}
        </p>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div>
          <label htmlFor="tour-persona-select" className="block text-xs font-medium text-foreground">
            {tOnboarding("activePersona")}
          </label>
          <select
            id="tour-persona-select"
            value={tour.persona}
            onChange={(e) => setTourSettings({ persona: e.target.value as Persona })}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="investor">{tOnboarding("personaInvestor")}</option>
            <option value="sme">{tOnboarding("personaSme")}</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Status:</span>
          <span className="font-medium text-foreground">
            {tour.completed ? tOnboarding("tourCompleted") : tour.skipped ? tOnboarding("tourSkipped") : tOnboarding("step", { current: (tour.stepIndex ?? 0) + 1, total: tour.persona === "sme" ? 3 : 4 })}
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          leftIcon={<Compass className="h-3.5 w-3.5" />}
          onClick={() => restartTour(tour.persona)}
        >
          {tOnboarding("restartTour")}
        </Button>
      </div>

      {/* ── Keyboard shortcuts toggle ──────────────────────────────────────── */}
      <div className="space-y-1 pt-2">
        <h3 className="text-base font-semibold text-foreground">{tSettings("keyboard.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {tSettings("keyboard.desc")}
        </p>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">{tSettings("keyboard.label")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tSettings("keyboard.hintPrefix")}{" "}
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">?</kbd>{" "}
              {tSettings("keyboard.hintSuffix")}
            </p>
          </div>
        </div>
        <Toggle
          checked={shortcutsEnabled}
          onChange={setShortcutsEnabled}
          ariaLabel="Toggle keyboard shortcuts"
        />
      </div>
    </div>
  );
}
