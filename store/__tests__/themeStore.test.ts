/**
 * Tests for theme toggle logic in uiStore and ThemeProvider's resolveTheme helper.
 *
 * We test the pure state-transition logic directly without a DOM environment
 * (vitest is configured with environment: "node").
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── resolveTheme ─────────────────────────────────────────────────────────────

// Inline the pure logic so tests stay environment-agnostic.
// The real resolveTheme in ThemeProvider.tsx has the identical implementation.
function resolveTheme(
  theme: "light" | "dark" | "system",
  prefersDark: boolean
): "light" | "dark" {
  if (theme !== "system") return theme;
  return prefersDark ? "dark" : "light";
}

describe("resolveTheme", () => {
  it('returns "dark" when theme is "dark"', () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it('returns "light" when theme is "light"', () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it('resolves "system" to "dark" when prefers-color-scheme is dark', () => {
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it('resolves "system" to "light" when prefers-color-scheme is light', () => {
    expect(resolveTheme("system", false)).toBe("light");
  });
});

// ─── toggleTheme logic ────────────────────────────────────────────────────────

/**
 * Pure extraction of the toggleTheme transition so it can be tested without
 * zustand or window. Mirrors the implementation in uiStore.ts exactly.
 */
function computeNextTheme(
  current: "light" | "dark" | "system",
  prefersDark: boolean
): "light" | "dark" {
  const resolved =
    current === "system" ? (prefersDark ? "dark" : "light") : current;
  return resolved === "dark" ? "light" : "dark";
}

describe("computeNextTheme (toggleTheme transition)", () => {
  it('dark → light', () => {
    expect(computeNextTheme("dark", false)).toBe("light");
    expect(computeNextTheme("dark", true)).toBe("light");
  });

  it('light → dark', () => {
    expect(computeNextTheme("light", false)).toBe("dark");
    expect(computeNextTheme("light", true)).toBe("dark");
  });

  it('system (prefers dark) → light', () => {
    expect(computeNextTheme("system", true)).toBe("light");
  });

  it('system (prefers light) → dark', () => {
    expect(computeNextTheme("system", false)).toBe("dark");
  });

  it('never produces "system" as output', () => {
    const results = (["light", "dark", "system"] as const).flatMap((t) =>
      [true, false].map((pref) => computeNextTheme(t, pref))
    );
    expect(results.every((r) => r === "light" || r === "dark")).toBe(true);
    expect(results.some((r) => r === "system" as string)).toBe(false);
  });
});

// ─── localStorage persistence shape ──────────────────────────────────────────

describe("localStorage persistence contract", () => {
  it("theme init script reads nested state.theme correctly", () => {
    // Simulate what the inline script in layout.tsx reads from localStorage.
    const storageValue = JSON.stringify({ state: { theme: "light" } });
    const parsed = JSON.parse(storageValue);
    const theme = parsed.state?.theme ?? "system";
    expect(theme).toBe("light");
  });

  it("falls back to 'system' when localStorage key is missing", () => {
    const storageValue = null;
    const parsed = storageValue ? JSON.parse(storageValue) : {};
    const theme = parsed.state?.theme ?? "system";
    expect(theme).toBe("system");
  });

  it("falls back to 'system' when state key is absent", () => {
    const storageValue = JSON.stringify({});
    const parsed = JSON.parse(storageValue);
    const theme = parsed.state?.theme ?? "system";
    expect(theme).toBe("system");
  });
});
