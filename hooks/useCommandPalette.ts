"use client";

import { useCallback, useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { containsStellarAddress, redactStellarAddresses } from "@/lib/debtorPrivacy";

const RECENT_KEY = "kora-cmd-recent";
const MAX_RECENT = 5;

export interface RecentItem {
  id: string;
  label: string;
  href: string;
  type: "page" | "invoice";
}

/**
 * Short list of command-palette–specific shortcuts for the
 * ShortcutReferenceModal (complements SHORTCUT_DEFINITIONS in useKeyboardShortcuts).
 */
export const COMMAND_PALETTE_SHORTCUTS: Array<{
  label: string;
  description: string;
}> = [
  { label: "⌘K / Ctrl+K", description: "Open / close command palette" },
  { label: "↑ ↓", description: "Navigate results" },
  { label: "↵", description: "Select highlighted command" },
  { label: "Esc", description: "Close command palette" },
];

/**
 * Privacy redaction for recent destinations (#1181). Recents live in
 * localStorage, readable by anyone using the same browser, so:
 *  - full Stellar addresses in labels are truncated (`GABC…WXYZ`);
 *  - destinations whose URL embeds a full address are not kept at all,
 *    because the href cannot be truncated without breaking navigation;
 *  - malformed entries (corrupted or hand-edited storage) are dropped.
 * Returns `null` when the item must not be stored or shown.
 */
export function sanitizeRecentItem(item: unknown): RecentItem | null {
  if (!item || typeof item !== "object") return null;
  const { id, label, href, type } = item as Partial<RecentItem>;
  if (typeof id !== "string" || typeof label !== "string" || typeof href !== "string") {
    return null;
  }
  if (type !== "page" && type !== "invoice") return null;
  if (containsStellarAddress(href) || containsStellarAddress(id)) return null;
  return { id, href, type, label: redactStellarAddresses(label) };
}

function loadRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    // Also redacts entries written before #1181 existed.
    return parsed
      .map(sanitizeRecentItem)
      .filter((item): item is RecentItem => item !== null)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecent(items: RecentItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: recents are a convenience, never fail navigation.
  }
}

export function useCommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);

  // Cmd/Ctrl+K global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);

  const getRecent = useCallback((): RecentItem[] => loadRecent(), []);

  const pushRecent = useCallback((item: RecentItem) => {
    const safe = sanitizeRecentItem(item);
    if (!safe) return;
    const prev = loadRecent().filter((r) => r.id !== safe.id);
    saveRecent([safe, ...prev].slice(0, MAX_RECENT));
  }, []);

  const clearRecent = useCallback(() => {
    saveRecent([]);
  }, []);

  return { open, setOpen, getRecent, pushRecent, clearRecent };
}
