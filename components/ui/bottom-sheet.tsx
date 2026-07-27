"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * BottomSheet component - a slide-up panel from the bottom of the screen.
 * Mobile-optimized for responsive layouts, appears on screens below lg breakpoint.
 * Dismissible by overlay tap, Escape key, or swipe (swipe via browser back gesture).
 *
 * Keyboard support (#440): Escape closes the sheet, focus moves into the
 * panel on open and returns to the triggering element on close, and Tab is
 * trapped within the panel while it's open — mirrors the focus-trap pattern
 * already used by ShortcutReferenceModal.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop - dismissible by tap */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Bottom Sheet Panel */}
      <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          className={cn(
            "relative z-50 w-full rounded-t-[32px] border border-zinc-900 bg-zinc-950 p-6 shadow-2xl shadow-black/40",
            "max-h-[90vh] overflow-hidden focus:outline-none",
            "animate-in slide-in-from-bottom-5 duration-300"
          )}
        >
          {/* Header with title and close button */}
          {title && (
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
              <h2 id={titleId} className="text-md font-bold text-zinc-150">{title}</h2>
              <button
                onClick={() => onOpenChange(false)}
                aria-label={`Close ${title}`}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Scrollable content area */}
          <div className={cn(
            "flex flex-col overflow-hidden",
            title ? "h-[calc(90vh-5rem)]" : "h-[calc(90vh-1.5rem)]"
          )}>
            <div className="overflow-y-auto pr-2 space-y-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
