/**
 * Clipboard copy feedback — integration tests (issue #1251)
 *
 * Tests the full copy-feedback contract across the happy path, failure path,
 * toast feedback (critical for mobile where tooltips don't fire), and a11y
 * aria-label flipping.
 *
 * Uses the real useCopyToClipboard hook; only the browser Clipboard API is
 * mocked so the behaviour is exercised end-to-end through the component tree.
 *
 * Timer-based tests (reset window) live in useCopyToClipboard.test.ts so
 * fake timers never bleed into async waitFor calls here.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoist toast mocks so vi.mock sees them ────────────────────────────────
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError, loading: vi.fn(), promise: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      copyAriaLabel: "Copy",
      copiedAriaLabel: "Copied",
      failedAriaLabel: "Copy failed",
      copyTooltip: "Copy",
      copiedTooltip: "Copied!",
      failedTooltip: "Copy failed",
      copiedToast: "Copied!",
      failedToast: "Copy failed — please try again",
    };
    return map[key] ?? key;
  },
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { CopyButton } from "@/components/ui/CopyButton";

// ─────────────────────────────────────────────────────────────────────────────

describe("CopyButton (clipboard feedback integration)", () => {
  // Reset clipboard to a working state before every test so previous overrides
  // never bleed into the next test.
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // Restore execCommand to a benign default if it was overridden.
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("renders with 'Copy' aria-label initially", () => {
    render(<CopyButton text="GINV-001" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("flips aria-label to 'Copied' after a successful click", async () => {
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("calls navigator.clipboard.writeText with the provided text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("GINV-001"));
  });

  it("fires a success toast after a successful copy (mobile feedback)", async () => {
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Copied!"));
  });

  it("fires the success toast exactly once per click", async () => {
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledOnce());
  });

  // ── Failure path ──────────────────────────────────────────────────────────

  it("flips aria-label to 'Copy failed' when the clipboard write is rejected", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
    });
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeInTheDocument();
  });

  it("fires an error toast so the user knows the copy failed", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
    });
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Copy failed — please try again"),
    );
  });

  it("does not fire a success toast when the copy fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
    });
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  // ── a11y ──────────────────────────────────────────────────────────────────

  it("has type=button to prevent accidental form submission", () => {
    render(<CopyButton text="x" />);
    expect(screen.getByRole("button", { name: "Copy" })).toHaveAttribute("type", "button");
  });

  it("aria-label updates to reflect each state transition", async () => {
    render(<CopyButton text="x" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Copy");
    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("button")).toHaveAccessibleName("Copied");
  });

  // ── Offline / degraded clipboard ──────────────────────────────────────────

  it("surfaces failure when navigator.clipboard is undefined and execCommand fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeInTheDocument();
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Copy failed — please try again"),
    );
  });
});
