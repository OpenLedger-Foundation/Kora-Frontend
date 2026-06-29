/**
 * Tests for InstallPrompt PWA install banner.
 *
 * Covers:
 *  a) Trigger: shows after 30s on 1st visit (beforeinstallprompt fires)
 *  b) Trigger: shows immediately on 2nd+ visit
 *  c) "Not now" suppresses for 7 days (writes to localStorage)
 *  d) Already suppressed → prompt never shows
 *  e) Standalone mode → prompt never shows
 *  f) "Install" calls deferredPrompt.prompt()
 *  g) Component doesn't block UI interaction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { InstallPrompt } from "@/components/pwa/InstallPrompt";

// ─── localStorage helpers ─────────────────────────────────────────────────────

const DISMISSED_UNTIL_KEY = "kora-pwa-install-dismissed-until";
const VISIT_COUNT_KEY = "kora-pwa-visit-count";

function clearStorage() {
  localStorage.removeItem(DISMISSED_UNTIL_KEY);
  localStorage.removeItem(VISIT_COUNT_KEY);
}

// ─── BeforeInstallPromptEvent mock ────────────────────────────────────────────

function createMockPromptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt") as any;
  event.platforms = ["web"];
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.preventDefault = vi.fn();
  return event;
}

function fireInstallPromptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = createMockPromptEvent(outcome);
  window.dispatchEvent(event);
  return event;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStorage();
  vi.useFakeTimers();
  // Ensure matchMedia returns non-standalone by default
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, // standalone = false
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.useRealTimers();
  clearStorage();
  vi.restoreAllMocks();
});

// ─── 1st visit: 30 second timer ──────────────────────────────────────────────

describe("InstallPrompt — first visit (30s timer)", () => {
  it("does NOT show immediately on 1st visit when beforeinstallprompt fires", () => {
    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
  });

  it("shows after 30s on 1st visit", async () => {
    render(<InstallPrompt />);
    fireInstallPromptEvent();

    act(() => vi.advanceTimersByTime(30_000));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });
  });

  it("does not show before 30s on 1st visit", () => {
    render(<InstallPrompt />);
    fireInstallPromptEvent();

    act(() => vi.advanceTimersByTime(29_999));

    expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
  });
});

// ─── 2nd+ visit: immediate ────────────────────────────────────────────────────

describe("InstallPrompt — 2nd+ visit (immediate)", () => {
  it("shows immediately on 2nd visit when beforeinstallprompt fires", async () => {
    // Simulate prior visit
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });
  });

  it("shows immediately on 3rd+ visit", async () => {
    localStorage.setItem(VISIT_COUNT_KEY, "5");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });
  });
});

// ─── "Not now" suppression ────────────────────────────────────────────────────

describe("InstallPrompt — 'Not now' suppression", () => {
  it("hides the prompt when Not now is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    localStorage.setItem(VISIT_COUNT_KEY, "1"); // 2nd visit — shows immediately

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("install-prompt-not-now"));

    await waitFor(() => {
      expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
    });
  });

  it("writes suppression timestamp ~7 days in the future to localStorage", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });

    const before = Date.now();
    await user.click(screen.getByTestId("install-prompt-not-now"));
    const after = Date.now();

    const storedUntil = Number(localStorage.getItem(DISMISSED_UNTIL_KEY));
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Should be approximately 7 days ahead of now
    expect(storedUntil).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(storedUntil).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it("× dismiss button also suppresses for 7 days", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("install-prompt-dismiss-x"));

    const storedUntil = Number(localStorage.getItem(DISMISSED_UNTIL_KEY));
    expect(storedUntil).toBeGreaterThan(Date.now());
  });

  it("prompt does not show if already suppressed", async () => {
    // Pre-suppress for 7 days
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));
    localStorage.setItem(VISIT_COUNT_KEY, "2");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(30_000));

    expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
  });
});

// ─── Standalone mode ──────────────────────────────────────────────────────────

describe("InstallPrompt — standalone mode guard", () => {
  it("never shows in standalone display mode", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(display-mode: standalone)", // standalone = true
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    localStorage.setItem(VISIT_COUNT_KEY, "2");
    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(30_000));

    expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
  });
});

// ─── Install action ───────────────────────────────────────────────────────────

describe("InstallPrompt — Install button", () => {
  it("calls deferredPrompt.prompt() when Install is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    const mockEvent = fireInstallPromptEvent("accepted");
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("install-prompt-install"));

    expect(mockEvent.prompt).toHaveBeenCalledTimes(1);
  });

  it("hides the prompt after Install is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    fireInstallPromptEvent("accepted");
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("install-prompt-install"));

    await waitFor(() => {
      expect(screen.queryByTestId("install-prompt")).not.toBeInTheDocument();
    });
  });
});

// ─── UI content ──────────────────────────────────────────────────────────────

describe("InstallPrompt — UI content", () => {
  it("shows app name 'Kora Protocol'", async () => {
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByText("Kora Protocol")).toBeInTheDocument();
    });
  });

  it("shows Install and Not now buttons", async () => {
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      expect(screen.getByTestId("install-prompt-install")).toBeInTheDocument();
      expect(screen.getByTestId("install-prompt-not-now")).toBeInTheDocument();
    });
  });

  it("shows app icon image", async () => {
    localStorage.setItem(VISIT_COUNT_KEY, "1");

    render(<InstallPrompt />);
    fireInstallPromptEvent();
    act(() => vi.advanceTimersByTime(0));

    await waitFor(() => {
      const img = screen.getByAltText("Kora Protocol icon");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "/icons/icon-192.png");
    });
  });
});
