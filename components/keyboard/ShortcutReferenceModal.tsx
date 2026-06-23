"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";
import { SHORTCUT_DEFINITIONS } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";

interface ShortcutReferenceModalProps {
  open: boolean;
  onClose: () => void;
}

// Group shortcuts by category
const CATEGORIES = ["Navigation", "Actions", "Help"] as const;

function groupShortcuts() {
  const groups: Record<string, Array<{ key: string; label: string; description: string }>> = {};
  for (const [key, def] of Object.entries(SHORTCUT_DEFINITIONS)) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push({ key, label: def.label, description: def.description });
  }
  return groups;
}

const GROUPED = groupShortcuts();

// ── Keyboard badge ─────────────────────────────────────────────────────────────
function KbdBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutReferenceModal({ open, onClose }: ShortcutReferenceModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="shortcut-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="shortcut-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts reference"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[9200] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-token-lg"
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="text-base font-semibold text-foreground">Keyboard Shortcuts</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close shortcuts reference"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcut table */}
            <div className="space-y-5">
              {CATEGORIES.map((category) => {
                const items = GROUPED[category];
                if (!items?.length) return null;
                return (
                  <section key={category} aria-labelledby={`shortcut-cat-${category}`}>
                    <h3
                      id={`shortcut-cat-${category}`}
                      className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      {category}
                    </h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      {items.map((item, idx) => (
                        <div
                          key={item.key}
                          className={cn(
                            "flex items-center justify-between px-4 py-2.5 text-sm",
                            idx !== items.length - 1 && "border-b border-border"
                          )}
                        >
                          <span className="text-foreground">{item.description}</span>
                          <KbdBadge>{item.label}</KbdBadge>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Footer hint */}
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Press <KbdBadge>?</KbdBadge> anytime to open this reference. Shortcuts can be disabled in{" "}
              <span className="text-foreground">Notification Settings</span>.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
