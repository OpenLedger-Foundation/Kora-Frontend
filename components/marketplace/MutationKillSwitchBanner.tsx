"use client";

import { PauseCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFeatureFlag, type FeatureFlag } from "@/lib/featureFlags";

/**
 * Visible notice shown in place of a mutation path that is switched off.
 * Replaces silent disables, which look like bugs during an incident.
 * Renders nothing while the flag is on.
 */
export function MutationKillSwitchBanner({ flag }: { flag: FeatureFlag }) {
  const t = useTranslations("killSwitch");
  const enabled = useFeatureFlag(flag);

  if (enabled) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
    >
      <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
      <div>
        <p className="font-medium">{t("title")}</p>
        <p className="mt-1 text-amber-100/80">{t("description")}</p>
      </div>
    </div>
  );
}
