"use client";

import { useEffect, useState } from "react";
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
  { id: "connect", title: "Connect Wallet", body: "Connect your Stellar wallet to get started.", selector: "button[aria-label=connect-wallet]", placement: "bottom" },
  { id: "create", title: "Create Invoice", body: "Create a tokenized invoice to raise liquidity.", selector: "a[href='/invoice/create']", placement: "bottom" },
  { id: "dashboard", title: "SME Dashboard", body: "Manage invoices, repayments and analytics.", selector: "a[href='/dashboard/sme']", placement: "right" },
  { id: "marketplace", title: "Marketplace", body: "View investor demand across marketplace listings.", selector: "a[href='/marketplace']", placement: "right" },
  { id: "analytics", title: "Analytics", body: "Track performance and investor interest.", selector: "a[href='/analytics']", placement: "left" },
];

const INVESTOR_STEPS: Step[] = [
  { id: "connect", title: "Connect Wallet", body: "Connect your Stellar wallet to invest.", selector: "button[aria-label=connect-wallet]", placement: "bottom" },
  { id: "marketplace", title: "Marketplace", body: "Browse available invoice listings.", selector: "a[href='/marketplace']", placement: "right" },
  { id: "filter", title: "Filters", body: "Refine search by category, jurisdiction and risk.", selector: "input[placeholder='Search']", placement: "bottom" },
  { id: "fund", title: "Fund an Invoice", body: "Choose an invoice and fund to earn yield.", selector: "button:has-text('Fund Invoice')", placement: "left" },
  { id: "dashboard", title: "Investor Dashboard", body: "View your active positions and returns.", selector: "a[href='/dashboard/investor']", placement: "left" },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    try {
      const shown = localStorage.getItem(STORAGE_KEY);
      if (!shown) setTimeout(() => setOpen(true), 600);
    } catch (e) {
      // ignore
    }
  }, []);

  const steps = role === "sme" ? SME_STEPS : role === "investor" ? INVESTOR_STEPS : [];

  const current = role ? steps[stepIndex] : null;

  const close = () => setOpen(false);

  const skip = () => {
    setOpen(false);
  };

  const finish = (dontShowAgain = false) => {
    setOpen(false);
    if (dontShowAgain) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (e) {}
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

  if (!role) {
    return (
      <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <h3 className="text-lg font-semibold">Welcome to Kora</h3>
          <p className="mt-2 text-sm text-zinc-400">Are you an SME or an Investor?</p>
          <div className="mt-4 flex justify-center gap-3">
            <button className="rounded-md bg-zinc-800 px-4 py-2" onClick={() => setRole("sme")}>SME</button>
            <button className="rounded-md bg-zinc-800 px-4 py-2" onClick={() => setRole("investor")}>Investor</button>
          </div>
          <div className="mt-4 text-xs text-zinc-500">
            <button onClick={skip}>Skip tour</button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div>
      <TourTooltip targetSelector={current.selector} open={true} placement={current.placement}>
        <div className="font-semibold">{current.title}</div>
        <div className="mt-1 text-xs text-zinc-400">{current.body}</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="text-xs text-zinc-400" onClick={() => { skip(); }}>Skip tour</button>
            {stepIndex === steps.length - 1 ? (
              <button className="text-xs text-zinc-400" onClick={() => finish(true)}>Don't show again</button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded border border-zinc-800 text-xs" onClick={prev} disabled={stepIndex === 0}>Back</button>
            <button className="px-3 py-1 rounded bg-kora-500 text-white text-xs" onClick={next}>{stepIndex === steps.length - 1 ? "Finish" : "Next"}</button>
          </div>
        </div>
      </TourTooltip>
    </div>
  );
}
