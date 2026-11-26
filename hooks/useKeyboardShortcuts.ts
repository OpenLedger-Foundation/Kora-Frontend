"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ShortcutDefinition {
  /** Human-readable key sequence label, e.g. "⌘K" or "G M" */
  label: string;
  /** Short description shown in the reference modal */
  description: string;
  /** i18n key for the localized description (falls back to `description`) */
  descriptionKey?: string;
  /** Category for grouping in the modal */
  category: "Navigation" | "Marketplace" | "Dashboard" | "Command Palette";
  /** When true, only registered in dev builds */
  devOnly?: boolean;
}

/** A user-defined remap of a shortcut id to a new key combination */
export type ShortcutRemap = Record<string, string>;

/** A detected conflict between two shortcuts sharing the same key combination */
export interface ShortcutConflict {
  /** Canonical key combination that is duplicated */
  combination: string;
  /** Ids of the shortcuts that collide */
  ids: string[];
}

// ── Shortcut registry (exported for the modal) ────────────────────────────────
export const SHORTCUT_DEFINITIONS: Record<string, ShortcutDefinition> = {
  "cmd+k": {
    label: "⌘K / Ctrl+K",
    description: "Open command palette",
    descriptionKey: "shortcuts.openCommandPalette",
    category: "Command Palette",
  },
  "cmd+w-wallet": {
    label: "⌘W / Ctrl+W",
    description: "Open wallet modal",
    descriptionKey: "shortcuts.openWalletModal",
    category: "Command Palette",
  },
  "g m": {
    label: "G M",
    description: "Go to Marketplace",
    descriptionKey: "shortcuts.goToMarketplace",
    category: "Navigation",
  },
  "g d": {
    label: "G D",
    description: "Go to Dashboard",
    descriptionKey: "shortcuts.goToDashboard",
    category: "Navigation",
  },
  "g c": {
    label: "G C",
    description: "Go to Create Invoice",
    descriptionKey: "shortcuts.goToCreateInvoice",
    category: "Navigation",
  },
  "g t": {
    label: "G T",
    description: "Go to Transaction History",
    descriptionKey: "shortcuts.goToTransactionHistory",
    category: "Navigation",
  },
  "g a": {
    label: "G A",
    description: "Go to Analytics",
    descriptionKey: "shortcuts.goToAnalytics",
    category: "Navigation",
  },
  "?": {
    label: "?",
    description: "Open shortcut reference",
    descriptionKey: "shortcuts.openShortcutReference",
    category: "Navigation",
  },
  "arrows-filters": {
    label: "← → / ↑ ↓",
    description: "Move between options within a filter group",
    descriptionKey: "shortcuts.moveBetweenFilterOptions",
    category: "Marketplace",
  },
  "esc-filters": {
    label: "Esc",
    description: "Close the filter panel",
    descriptionKey: "shortcuts.closeFilterPanel",
    category: "Marketplace",
  },
  ...(process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true"
    ? {
        "ctrl+shift+v": {
          label: "Ctrl+Shift+V",
          description: "Toggle Web Vitals panel (dev only)",
          descriptionKey: "shortcuts.toggleWebVitals",
          category: "Navigation" as const,
          devOnly: true,
        },
      }
    : {}),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the event target is an interactive text input */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Normalise a KeyboardEvent into a canonical key string */
function eventToKey(e: KeyboardEvent): string {
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (mod && e.shiftKey) return `ctrl+shift+${key}`;
  if (mod) return `cmd+${key}`;
  return key;
}

/**
 * Normalise a shortcut label (e.g. "G M", "⌘K / Ctrl+K") into a canonical
 * key combination so that equivalent labels can be compared for conflicts.
 */
export function normalizeShortcutLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/⌘/g, "cmd")
    .replace(/ctrl/g, "cmd")
    .replace(/\s*\/\s*/g, "+")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect shortcuts that share the same key combination. Accepts an optional
 * map of user remaps (shortcut id → new label) which override the defaults.
 */
export function detectShortcutConflicts(
  definitions: Record<string, ShortcutDefinition> = SHORTCUT_DEFINITIONS,
  remaps: ShortcutRemap = {},
): ShortcutConflict[] {
  const byCombination = new Map<string, string[]>();

  for (const [id, def] of Object.entries(definitions)) {
    const label = remaps[id] ?? def.label;
    const combination = normalizeShortcutLabel(label);
    const ids = byCombination.get(combination) ?? [];
    ids.push(id);
    byCombination.set(combination, ids);
  }

  const conflicts: ShortcutConflict[] = [];
  for (const [combination, ids] of byCombination.entries()) {
    if (ids.length > 1) conflicts.push({ combination, ids });
  }
  return conflicts;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
/**
 * useKeyboardShortcuts
 *
 * Registers global keyboard shortcuts. Supports:
 * - Single-key shortcuts (e.g. "?")
 * - Modifier shortcuts (e.g. Cmd/Ctrl+K)
 * - Two-key sequences (e.g. "G M" — press G then M within 1 500 ms)
 *
 * Shortcuts are disabled when the user is typing in an input field, or when
 * `shortcutsEnabled` is false in the UI store.
 */
export function useKeyboardShortcuts({
  onOpenSearch,
  onOpenShortcutModal,
  onToggleWebVitals,
  remaps,
}: {
  onOpenSearch?: () => void;
  onOpenShortcutModal?: () => void;
  onToggleWebVitals?: () => void;
  /** Optional user remaps (shortcut id → new label) */
  remaps?: ShortcutRemap;
}) {
  const router = useRouter();
  const setWalletModalOpen = useUIStore((s) => s.setWalletModalOpen);
  const shortcutsEnabled = useUIStore((s) => s.shortcutsEnabled);

  // Sequence buffer: stores the last key pressed for two-key sequences
  const sequenceRef = useRef<string | null>(null);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSequence = useCallback(() => {
    sequenceRef.current = null;
    if (sequenceTimerRef.current) {
      clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  // Warn about conflicting shortcuts (including user remaps) once per mount
  useEffect(() => {
    const conflicts = detectShortcutConflicts(SHORTCUT_DEFINITIONS, remaps);
    if (conflicts.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[useKeyboardShortcuts] Conflicting shortcuts detected:",
        conflicts,
      );
    }
  }, [remaps]);

  useEffect(() => {
    if (!shortcutsEnabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Never fire when user is typing
      if (isInputFocused()) return;

      const key = eventToKey(e);

      // ── Modifier shortcuts (fire immediately) ──────────────────────────────
      if (key === "cmd+k") {
        e.preventDefault();
        onOpenSearch?.();
        clearSequence();
        return;
      }

      if (key === "cmd+w") {
        // Only intercept if not a browser tab-close scenario (no modifier ambiguity on Mac)
        e.preventDefault();
        setWalletModalOpen(true);
        clearSequence();
        return;
      }

      // ── Dev-only shortcuts ─────────────────────────────────────────────────
      if (
        key === "ctrl+shift+v" &&
        process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true"
      ) {
        e.preventDefault();
        onToggleWebVitals?.();
        clearSequence();
        return;
      }

      // ── Single-key shortcuts ───────────────────────────────────────────────
      if (key === "?") {
        e.preventDefault();
        onOpenShortcutModal?.();
        clearSequence();
        return;
      }

      // ── Two-key sequences (G + letter) ─────────────────────────────────────
      if (key === "g" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        clearSequence();
        sequenceRef.current = "g";
        // Auto-clear after 1.5 s if no second key
        sequenceTimerRef.current = setTimeout(clearSequence, 1500);
        return;
      }

      if (sequenceRef.current === "g") {
        clearSequence();
        switch (key) {
          case "m":
            e.preventDefault();
            router.push("/marketplace");
            break;
          case "d":
            e.preventDefault();
            router.push("/dashboard/investor");
            break;
          case "c":
            e.preventDefault();
            router.push("/invoice/create");
            break;
          case "t":
            e.preventDefault();
            router.push("/transactions");
            break;
          case "a":
            e.preventDefault();
            router.push("/analytics");
            break;
          default:
            break;
        }
        return;
      }

      // Any other key clears the sequence buffer
      clearSequence();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearSequence();
    };
  }, [
    shortcutsEnabled,
    router,
    setWalletModalOpen,
    onOpenSearch,
    onOpenShortcutModal,
    onToggleWebVitals,
    clearSequence,
  ]);
}
