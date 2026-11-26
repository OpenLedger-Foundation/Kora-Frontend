"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeatureFlag } from "@/lib/featureFlags";

interface FeatureFlagKillSwitchBannerProps {
  flag: FeatureFlag;
  className?: string;
}

/**
 * Shown when a marketplace mutation feature flag is disabled at the env level.
 * Replaces silent no-ops so users understand the feature is intentionally off.
 */
export function FeatureFlagKillSwitchBanner({
  flag,
  className,
}: FeatureFlagKillSwitchBannerProps) {
  const t = useTranslations("featureFlags");

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 ${className ?? ""}`}
      data-testid={`kill-switch-banner-${flag}`}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t("featureDisabled", { flag })}</span>
    </div>
  );
}
