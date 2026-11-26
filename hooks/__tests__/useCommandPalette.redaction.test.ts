/**
 * Command palette recent destinations with privacy redaction — Issue #1181.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { sanitizeRecentItem, useCommandPalette } from "@/hooks/useCommandPalette";

vi.mock("@/store/uiStore", () => ({
  useUIStore: (selector: (s: { commandPaletteOpen: boolean; setCommandPaletteOpen: () => void }) => unknown) =>
    selector({ commandPaletteOpen: false, setCommandPaletteOpen: () => {} }),
}));

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const RECENT_KEY = "kora-cmd-recent";

beforeEach(() => localStorage.clear());

describe("sanitizeRecentItem", () => {
  it("truncates full Stellar addresses in labels", () => {
    expect(
      sanitizeRecentItem({ id: "/x", href: "/x", type: "page", label: `Pay ${ADDRESS}` })
    ).toEqual({ id: "/x", href: "/x", type: "page", label: "Pay GAAA…AWHF" });
  });

  it("drops destinations whose URL embeds a full address", () => {
    expect(
      sanitizeRecentItem({ id: `/portfolio/${ADDRESS}`, href: `/portfolio/${ADDRESS}`, type: "page", label: "Portfolio" })
    ).toBeNull();
  });

  it("drops malformed entries", () => {
    expect(sanitizeRecentItem(null)).toBeNull();
    expect(sanitizeRecentItem({ id: 1, href: "/x", type: "page", label: "x" })).toBeNull();
    expect(sanitizeRecentItem({ id: "/x", href: "/x", type: "other", label: "x" })).toBeNull();
  });
});

describe("useCommandPalette recents redaction", () => {
  it("never writes a full address to localStorage", () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => {
      result.current.pushRecent({ id: "/inv/1", href: "/inv/1", type: "invoice", label: `INV-1 ${ADDRESS}` });
      result.current.pushRecent({ id: `/p/${ADDRESS}`, href: `/p/${ADDRESS}`, type: "page", label: "x" });
    });
    const stored = localStorage.getItem(RECENT_KEY) ?? "";
    expect(stored).not.toContain(ADDRESS);
    expect(result.current.getRecent()).toEqual([
      { id: "/inv/1", href: "/inv/1", type: "invoice", label: "INV-1 GAAA…AWHF" },
    ]);
  });

  it("redacts legacy entries written before redaction existed", () => {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([
        { id: "/a", href: "/a", type: "page", label: ADDRESS },
        { id: `/b/${ADDRESS}`, href: `/b/${ADDRESS}`, type: "page", label: "b" },
        "corrupt",
      ])
    );
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.getRecent()).toEqual([{ id: "/a", href: "/a", type: "page", label: "GAAA…AWHF" }]);
  });

  it("returns [] for non-array or invalid JSON storage", () => {
    localStorage.setItem(RECENT_KEY, "{bad");
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.getRecent()).toEqual([]);
    localStorage.setItem(RECENT_KEY, JSON.stringify({ not: "array" }));
    expect(result.current.getRecent()).toEqual([]);
  });
});
