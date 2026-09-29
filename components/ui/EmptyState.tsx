"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export type EmptyStateVariant =
  | "no-invoices"
  | "no-positions"
  | "no-transactions"
  | "no-results"
  | "marketplace"
  | "sme"
  | "investor"
  | "transactions"
  | "analytics";

/** A single one-click recovery action shown below the empty-state message. */
export interface RecoverySuggestion {
  /** i18n key within the "marketplace.recovery" namespace, or a plain label. */
  label: string;
  /** Called when the user clicks the suggestion chip. */
  onClick: () => void;
}

type Props = {
  /** Override heading. When omitted the variant's translated default is used. */
  title?: string;
  /** Override description. When omitted the variant's translated default is used. */
  description?: string;
  cta?: { label: string; onClick: () => void } | null;
  variant?: EmptyStateVariant;
  className?: string;
  /**
   * One-click recovery suggestions shown as chips below the description.
   * Intended for the marketplace empty state (#564).
   */
  suggestions?: RecoverySuggestion[];
};

// Icons are UI concerns, not copy — keep them here rather than in messages.
const VARIANT_ICONS: Record<EmptyStateVariant, string> = {
  "no-invoices": "📄",
  "no-positions": "📊",
  "no-transactions": "🔄",
  "no-results": "🔍",
  marketplace: "🏪",
  sme: "📄",
  investor: "📊",
  transactions: "🔄",
  analytics: "📈",
};

function Illustration({ variant }: { variant: EmptyStateVariant }) {
  return (
    <span className="text-6xl" role="img" aria-hidden="true">
      {VARIANT_ICONS[variant]}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  cta = null,
  variant = "marketplace",
  className = "",
  suggestions,
}: Props) {
  const t = useTranslations("emptyState");

  const displayTitle = title || t(`variants.${variant}.heading`);
  const displayDescription = description ?? t(`variants.${variant}.subtext`);

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center ${className}`}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Illustration variant={variant} />
      </motion.div>
      <h3 className="text-lg font-semibold text-foreground">{displayTitle}</h3>
      {displayDescription && (
        <p className="text-sm text-muted-foreground max-w-xl">{displayDescription}</p>
      )}

      {/* Recovery suggestion chips (#564) */}
      {suggestions && suggestions.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-2 mt-1"
          aria-label={t("suggestionsAria")}
          data-testid="empty-state-suggestions"
        >
          {suggestions.map((suggestion, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={suggestion.onClick}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              data-testid={`recovery-suggestion-${i}`}
            >
              {suggestion.label}
            </motion.button>
          ))}
        </div>
      )}

      {cta && (
        <div className="mt-2">
          <Button onClick={cta.onClick}>{cta.label}</Button>
        </div>
      )}
    </div>
  );
}

export default EmptyState;
