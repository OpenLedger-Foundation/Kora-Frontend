"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import TourTooltip from "./TourTooltip";

export const TOUR_STORAGE_KEY = "kora-tour-done";

const INVESTOR_STEPS = [
  {
    title: "Find the right opportunity",
    body: "Search by debtor, invoice number, or jurisdiction to narrow the marketplace.",
    selector: "[data-tour='marketplace-search']",
    placement: "bottom" as const,
  },
  {
    title: "Review invoice details",
    body: "Each card summarizes the amount, return, risk tier, funding progress, and maturity.",
    selector: "[data-tour='invoice-card']",
    placement: "right" as const,
  },
  {
    title: "Fund an invoice",
    body: "Open an eligible listing from its funding action when you are ready to invest.",
    selector: "[data-tour='fund-button']",
    placement: "top" as const,
  },
  {
    title: "Track your portfolio",
    body: "Use the investor dashboard to monitor positions, repayments, and earned yield.",
    selector: "[data-tour='investor-dashboard']",
    placement: "bottom" as const,
  },
];

export default function OnboardingTour() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Exact-path matching prevents the tour from running on invoice deep links.
    if (pathname !== "/marketplace") {
      setOpen(false);
      return;
    }

    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY) !== "true") {
        const timer = window.setTimeout(() => setOpen(true), 400);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // If storage is unavailable, do not repeatedly interrupt the user.
    }
  }, [pathname]);

  const complete = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {
      // The tour can still close when storage is unavailable.
    }
    setOpen(false);
  };

  const current = INVESTOR_STEPS[stepIndex];
  if (!open || pathname !== "/marketplace") return null;

  return (
    <TourTooltip
      targetSelector={current.selector}
      open
      placement={current.placement}
      onClose={complete}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-primary">
          Step {stepIndex + 1} of {INVESTOR_STEPS.length}
        </span>
        <button
          type="button"
          onClick={complete}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Skip onboarding tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{
            width: `${((stepIndex + 1) / INVESTOR_STEPS.length) * 100}%`,
          }}
        />
      </div>

      <h2 className="mb-1 font-semibold text-foreground">{current.title}</h2>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {current.body}
      </p>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={complete}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStepIndex((step) => step - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              stepIndex === INVESTOR_STEPS.length - 1
                ? complete()
                : setStepIndex((step) => step + 1)
            }
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {stepIndex === INVESTOR_STEPS.length - 1 ? "Finish" : "Next"}
            {stepIndex < INVESTOR_STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    </TourTooltip>
  );
}
