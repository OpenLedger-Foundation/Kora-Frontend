/**
 * WebVitalsPanel tests.
 *
 * The component is gated on NEXT_PUBLIC_ENABLE_DEVTOOLS or NODE_ENV === "development".
 * We stub the env var before importing to exercise the rendered path.
 */
import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WebVitalsPanel } from "./WebVitalsPanel";

// jsdom doesn't set these by default
Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 900 });
Object.defineProperty(window, "innerWidth",  { writable: true, configurable: true, value: 1280 });

describe("WebVitalsPanel", () => {
  beforeEach(() => {
    // Ensure devtools flag is set so the component renders
    process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS = "true";
  });

  it("renders when devtools are enabled", () => {
    render(<WebVitalsPanel />);
    expect(screen.getByTestId("web-vitals-panel")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Web Vitals Dev Panel/i })).toBeInTheDocument();
  });

  it("shows waiting message when no metrics received", () => {
    render(<WebVitalsPanel />);
    expect(screen.getByText(/Waiting for metrics/i)).toBeInTheDocument();
  });

  it("displays a vital entry when kora:webvital fires", () => {
    render(<WebVitalsPanel />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("kora:webvital", {
          detail: { name: "LCP", value: 1800, id: "v1", startTime: 0, label: "web-vital" },
        })
      );
    });
    expect(screen.getByText("LCP")).toBeInTheDocument();
  });

  it("hides on first kora:toggle-webvitals event", () => {
    render(<WebVitalsPanel />);
    expect(screen.getByTestId("web-vitals-panel")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent("kora:toggle-webvitals"));
    });
    expect(screen.queryByTestId("web-vitals-panel")).not.toBeInTheDocument();
  });

  it("re-shows on second kora:toggle-webvitals event", () => {
    render(<WebVitalsPanel />);

    act(() => { window.dispatchEvent(new CustomEvent("kora:toggle-webvitals")); });
    expect(screen.queryByTestId("web-vitals-panel")).not.toBeInTheDocument();

    act(() => { window.dispatchEvent(new CustomEvent("kora:toggle-webvitals")); });
    expect(screen.getByTestId("web-vitals-panel")).toBeInTheDocument();
  });

  it("hides when the dismiss button is clicked", async () => {
    render(<WebVitalsPanel />);
    const dismissBtn = screen.getByRole("button", { name: /hide web vitals panel/i });
    act(() => { dismissBtn.click(); });
    expect(screen.queryByTestId("web-vitals-panel")).not.toBeInTheDocument();
  });

  it("shows the keyboard shortcut hint", () => {
    render(<WebVitalsPanel />);
    expect(screen.getByText(/Ctrl\+Shift\+V/i)).toBeInTheDocument();
  });
});
