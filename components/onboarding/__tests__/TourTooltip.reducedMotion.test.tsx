/**
 * Reduced-motion behaviour of the onboarding tour (#1125).
 *
 * framer-motion reads `prefers-reduced-motion` once, on first render, so the
 * media query has to be stubbed before the component tree mounts. This file
 * exists on its own so that first read happens here rather than in a suite
 * that already initialised it with the default (motion-allowed) answer.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import TourTooltip from "../TourTooltip";

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("TourTooltip under prefers-reduced-motion (#1125)", () => {
  const scrollSpy = vi.fn();

  beforeEach(() => {
    scrollSpy.mockClear();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    document.body.innerHTML = "";
    const anchor = document.createElement("div");
    anchor.setAttribute("data-tour", "invoice-card");
    document.body.appendChild(anchor);
  });

  it("jumps to the target instead of smooth-scrolling", async () => {
    render(
      <TourTooltip targetSelector="[data-tour='invoice-card']" open placement="right">
        <p>Review invoice details</p>
      </TourTooltip>
    );

    expect(await screen.findByText("Review invoice details")).toBeInTheDocument();

    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    expect(scrollSpy).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("keeps the tooltip interactive without an entrance animation", async () => {
    render(
      <TourTooltip targetSelector="[data-tour='invoice-card']" open placement="right">
        <p>Review invoice details</p>
      </TourTooltip>
    );

    // With the spring skipped the dialog still mounts, focuses and stays usable.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeVisible();
    expect(dialog).toHaveFocus();
  });
});
