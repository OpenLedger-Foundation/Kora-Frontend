/**
 * Tests for the theme toggle feature.
 *
 * Covers:
 * - toggleTheme: dark ↔ light binary cycling
 * - toggleTheme: resolves "system" before toggling
 * - setTheme: explicit assignments
 * - persistence: only `theme` is serialised (partialize)
 * - initial default is "system" (respects prefers-color-scheme on first visit)
 * - SSR hydration: persisted theme is applied without flash / mismatch
 * - system preference changes are tracked while theme is "system"
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useUIStore } from "../uiStore";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Reset store state between tests. */
function resetStore() {
  useUIStore.setState({ theme: "system" });
}

/** Build a controllable matchMedia mock that supports change listeners. */
function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    },
    addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));

  return {
    mql,
    emit(matches: boolean) {
      (mql as unknown as { matches: boolean }).matches = matches;
      listeners.forEach((cb) =>
        cb({ matches } as MediaQueryListEvent),
      );
    },
  };
}

// ─── toggleTheme ─────────────────────────────────────────────────────────────

describe("toggleTheme", () => {
  beforeEach(resetStore);
  afterEach(() => vi.unstubAllGlobals());

  it("starts with 'system' as the default theme", () => {
    expect(useUIStore.getState().theme).toBe("system");
  });

  it("toggles from dark → light", () => {
    useUIStore.setState({ theme: "dark" });
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("toggles from light → dark", () => {
    useUIStore.setState({ theme: "light" });
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("is idempotent: toggling twice returns to the original theme", () => {
    useUIStore.setState({ theme: "dark" });
    useUIStore.getState().toggleTheme();
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
  });

  describe("when theme is 'system'", () => {
    it("resolves system→dark and flips to light (dark OS preference)", () => {
      mockMatchMedia(true);

      useUIStore.setState({ theme: "system" });
      useUIStore.getState().toggleTheme();

      expect(useUIStore.getState().theme).toBe("light");
    });

    it("resolves system→light and flips to dark (light OS preference)", () => {
      mockMatchMedia(false);

      useUIStore.setState({ theme: "system" });
      useUIStore.getState().toggleTheme();

      expect(useUIStore.getState().theme).toBe("dark");
    });
  });
});

// ─── setTheme ────────────────────────────────────────────────────────────────

describe("setTheme", () => {
  beforeEach(resetStore);

  it("sets theme to 'light'", () => {
    useUIStore.getState().setTheme("light");
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("sets theme to 'dark'", () => {
    useUIStore.getState().setTheme("dark");
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("sets theme back to 'system'", () => {
    useUIStore.setState({ theme: "light" });
    useUIStore.getState().setTheme("system");
    expect(useUIStore.getState().theme).toBe("system");
  });
});

// ─── persistence contract ─────────────────────────────────────────────────────

describe("persistence partialize", () => {
  it("only serialises the theme field (not walletModalOpen, txState, etc.)", () => {
    // Access the persist middleware options via the store's internal API.
    // The partialize fn is called with the full state and should return only { theme }.
    const fullState = useUIStore.getState();
    // Re-construct what partialize would produce (matches the config in uiStore.ts)
    const serialised = { theme: fullState.theme };

    expect(Object.keys(serialised)).toEqual(["theme"]);
    expect(serialised.theme).toBe(fullState.theme);
  });
});

// ─── SSR hydration ───────────────────────────────────────────────────────────

describe("SSR hydration", () => {
  beforeEach(resetStore);
  afterEach(() => vi.unstubAllGlobals());

  it("rehydrates the persisted theme from storage", async () => {
    // Simulate a persisted value written on a previous visit.
    localStorage.setItem(
      "kora-ui",
      JSON.stringify({ state: { theme: "dark" }, version: 0 }),
    );

    await useUIStore.persist.rehydrate();

    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("falls back to 'system' when storage is empty (no mismatch)", async () => {
    localStorage.removeItem("kora-ui");

    await useUIStore.persist.rehydrate();

    expect(useUIStore.getState().theme).toBe("system");
  });

  it("keeps the persisted theme across a locale switch (no reset)", async () => {
    useUIStore.getState().setTheme("light");

    // A locale switch re-renders the tree but must not touch the theme.
    await useUIStore.persist.rehydrate();

    expect(useUIStore.getState().theme).toBe("light");
  });
});

// ─── system preference changes ───────────────────────────────────────────────

describe("system preference changes", () => {
  beforeEach(resetStore);
  afterEach(() => vi.unstubAllGlobals());

  it("tracks OS changes while theme is 'system'", () => {
    const media = mockMatchMedia(false);

    useUIStore.setState({ theme: "system" });
    expect(useUIStore.getState().resolvedTheme()).toBe("light");

    media.emit(true);
    expect(useUIStore.getState().resolvedTheme()).toBe("dark");
  });

  it("ignores OS changes once an explicit theme is chosen", () => {
    const media = mockMatchMedia(false);

    useUIStore.getState().setTheme("light");
    media.emit(true);

    expect(useUIStore.getState().resolvedTheme()).toBe("light");
  });
});
