"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, TrendingUp, ChevronRight, X } from "lucide-react";
import TourTooltip from "./TourTooltip";

const STORAGE_KEY = "kora_onboarding_shown_v1";

type Role = "sme" | "investor" | null;

type Step = {
  id: string;
  title: string;
  body: string;
  selector?: string;
  placement?: "top" | "bottom" | "left" | "right";
};

const SME_STEPS: Step[] = [
  { id: "connect", title: "Connect Wallet", body: "Connect your Stellar wallet to get started and access invoice financing.", selector: "[data-tour='wallet-button']", placement: "bottom" },
  { id: "create", title: "Create Invoice", body: "Upload your unpaid invoice and tokenize it to raise liquidity from investors.", selector: "[data-tour='create-invoice-btn']", placement: "bottom" },
  { id: "marketplace", title: "Marketplace", body: "Browse investor demand and see competitive funding offers for your invoices.", selector: "[data-tour='marketplace-link']", placement: "right" },
  { id: "dashboard", title: "SME Dashboard", body: "Manage invoices, track repayments, and view your entire portfolio performance.", selector: "[data-tour='dashboard-link']", placement: "right" },
  { id: "analytics", title: "Analytics", body: "Monitor detailed metrics about investor interest and funding trends.", selector: "[data-tour='analytics-link']", placement: "left" },
];

const INVESTOR_STEPS: Step[] = [
  { id: "connect", title: "Connect Wallet", body: "Connect your Stellar wallet to start investing and earning yield.", selector: "[data-tour='wallet-button']", placement: "bottom" },
  { id: "marketplace", title: "Marketplace", body: "Browse available invoice listings from verified SMEs.", selector: "[data-tour='marketplace-link']", placement: "right" },
  { id: "filter", title: "Smart Search", body: "Use filters to find invoices by risk tier, sector, and return rates.", selector: "[data-tour='search-filters']", placement: "bottom" },
  { id: "fund", title: "Fund an Invoice", body: "Select an invoice and deploy capital to earn attractive yields.", selector: "[data-tour='fund-button']", placement: "left" },
  { id: "dashboard", title: "Investor Dashboard", body: "Track your active positions, yields earned, and portfolio performance.", selector: "[data-tour='investor-dashboard']", placement: "left" },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    try {
      const shown = localStorage.getItem(STORAGE_KEY);
      if (!shown) {
        setTimeout(() => setOpen(true), 800);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const steps = role === "sme" ? SME_STEPS : role === "investor" ? INVESTOR_STEPS : [];
  const current = role ? steps[stepIndex] : null;
  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;

  const close = () => setOpen(false);

  const skip = () => {
    setOpen(false);
  };

  const finish = (dontShowAgain = false) => {
    setOpen(false);
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch (e) {
        // ignore
      }
    }
  };

  const next = () => {
    if (!role) return;
    if (stepIndex + 1 >= steps.length) {
      finish(false);
    } else {
      setStepIndex((s) => s + 1);
    }
  };

  const prev = () => {
    setStepIndex((s) => Math.max(0, s - 1));
  };

  if (!open) return null;

  // Role selection modal
  if (!role) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99998] flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-lg rounded-2xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-2xl font-bold text-white">Welcome to Kora</h3>
              <button
                onClick={skip}
                className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>
            <p className="text-zinc-400 mb-8">What best describes your role?</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { role: "sme" as const, label: "SME", icon: Briefcase, desc: "Seeking invoice financing" },
                {
                  role: "investor" as const,
                  label: "Investor",
                  icon: TrendingUp,
                  desc: "Looking to earn yield",
                },
              ].map(({ role: r, label, icon: Icon, desc }) => (
                <motion.button
                  key={r}
                  onClick={() => setRole(r)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-kora-500/20 to-kora-400/20 rounded-xl opacity-0 group-hover:opacity-100 blur transition-opacity" />
                  <div className="relative border border-zinc-800/60 group-hover:border-kora-500/40 rounded-xl p-4 bg-zinc-900/50 group-hover:bg-zinc-900/80 transition-all">
                    <Icon className="h-6 w-6 text-kora-400 mb-2" />
                    <p className="font-semibold text-white">{label}</p>
                    <p className="text-xs text-zinc-500 mt-1">{desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="pt-4 border-t border-zinc-800/60">
              <button
                onClick={skip}
                className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Skip tour for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!current) return null;

  return (
    <div>
      <TourTooltip
        targetSelector={current.selector}
        open={true}
        placement={current.placement}
        onClose={close}
      >
        {/* Header with progress */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-kora-400">
              Step {stepIndex + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={close}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="h-4 w-4 text-zinc-400" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-kora-500 to-kora-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>

        {/* Content */}
        <div className="font-semibold text-white mb-1">{current.title}</div>
        <div className="text-xs text-zinc-400 mb-4">{current.body}</div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {stepIndex === steps.length - 1 && (
              <button
                className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                onClick={() => finish(true)}
              >
                Don't show again
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-2 py-1.5 rounded border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              onClick={prev}
              disabled={stepIndex === 0}
            >
              Back
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 rounded bg-gradient-to-r from-kora-500 to-kora-400 text-white text-xs font-medium hover:from-kora-600 hover:to-kora-500 transition-all flex items-center gap-1"
              onClick={next}
            >
              {stepIndex === steps.length - 1 ? "Finish" : "Next"}
              {stepIndex < steps.length - 1 && <ChevronRight className="h-3 w-3" />}
            </motion.button>
          </div>
        </div>
      </TourTooltip>
    </div>
  );
}
