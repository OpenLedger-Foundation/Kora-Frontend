import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), promise: vi.fn() },
}));

vi.mock("sonner", () => ({ toast }));

const EN_MAP: Record<string, string> = {
  copyAriaLabel: "Copy",
  copiedAriaLabel: "Copied",
  failedAriaLabel: "Copy failed",
  copyTooltip: "Copy",
  copiedTooltip: "Copied!",
  failedTooltip: "Copy failed",
  copiedToast: "Copied!",
  failedToast: "Copy failed — please try again",
};

let activeMap = EN_MAP;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => activeMap[key] ?? key,
}));

// Radix's Tooltip uses useSize, which calls ResizeObserver — not implemented in jsdom.
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

describe("CopyButton", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    activeMap = EN_MAP;
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("renders a translated aria-label before copying", () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("shows a translated tooltip before copying", async () => {
    render(<CopyButton text="hello" />);
    await userEvent.hover(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copy", { selector: "[role=tooltip]" })).toBeInTheDocument();
  });

  it("flips to the 'copied' aria-label after a successful click", async () => {
    render(<CopyButton text="hello" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("hello"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("fires a success toast after a successful copy", async () => {
    render(<CopyButton text="hello" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Copied!"));
  });
  it("does not fire a success toast more than once per copy action", async () => {
    render(<CopyButton text="hello" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
  });

  it("flips to 'copy failed' aria-label when the write is rejected", async () => {
    writeText.mockRejectedValueOnce(new Error("Permission denied"));
    render(<CopyButton text="secret" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeInTheDocument();
  });

  it("fires an error toast when the copy fails", async () => {
    writeText.mockRejectedValueOnce(new Error("Permission denied"));
    render(<CopyButton text="secret" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Copy failed — please try again"),
    );
  });

  it("does not fire a success toast when the copy fails", async () => {
    writeText.mockRejectedValueOnce(new Error("nope"));
    render(<CopyButton text="secret" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledOnce());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("renders Arabic translations when the locale map provides them", () => {
    activeMap = {
      copyAriaLabel: "نسخ",
      copiedAriaLabel: "تم النسخ",
      failedAriaLabel: "فشل النسخ",
      copyTooltip: "نسخ",
      copiedTooltip: "تم النسخ!",
      failedTooltip: "فشل النسخ",
      copiedToast: "تم النسخ!",
      failedToast: "فشل النسخ — يرجى المحاولة مجدداً",
    };
    render(<CopyButton text="hello" />);
    expect(screen.getByRole("button", { name: "نسخ" })).toBeInTheDocument();
  });

  it("button has type=button so it cannot accidentally submit a form", () => {
    render(<CopyButton text="x" />);
    expect(screen.getByRole("button", { name: "Copy" })).toHaveAttribute("type", "button");
  });

  it("surfaces failure when clipboard is unavailable and execCommand returns false", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    // execCommand fallback returning false triggers the error branch
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    render(<CopyButton text="GINV-001" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeInTheDocument();
  });
});
