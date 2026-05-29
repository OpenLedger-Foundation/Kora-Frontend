"use client";

/**
 * PWA Install Prompt — "Add to Home Screen" banner.
 *
 * Listens for the browser's `beforeinstallprompt` event and surfaces a
 * tasteful bottom banner on mobile. Dismissed state is persisted in
 * localStorage so it doesn't re-appear after the user says no.
 *
 * Security notes:
 *  - No user data is collected or transmitted.
 *  - The prompt is only shown on HTTPS (enforced by the browser).
 *  - We never call prompt() without an explicit user gesture.
 */

import { useEffect, useState, useCallback } from "react";
import { X, Download } from "lucide-react";

const DISMISSED_KEY = "kora-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already installed
    if (
      typeof window === "undefined" ||
      localStorage.getItem(DISMISSED_KEY) === "true" ||
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error — iOS Safari standalone detection
      window.navigator.standalone === true
    ) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
    setDeferredPrompt(null);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Kora Protocol app"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-6 sm:max-w-xs"
    >
      <div className="flex items-start gap-3">
        {/* App icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="Kora Protocol icon"
          width={44}
          height={44}
          className="shrink-0 rounded-xl"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">Add to Home Screen</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Install Kora for faster access and offline support.
          </p>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
