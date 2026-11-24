/**
 * Tests for the PWA InstallPrompt analytics wiring (Issue #708).
 *
 * InstallPrompt now calls the helpers in lib/installPromptAnalytics.ts on show,
 * install acceptance, and dismiss. These cover the local event log the helper
 * always writes (so the metric survives when no analytics SDK is loaded) and
 * assert that no PII leaks into the payload.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  trackInstallPromptShown,
  trackInstallPromptAccepted,
  trackInstallPromptDismissed,
  trackInstallPromptFailed,
  getLocalInstallPromptEvents,
  detectInstallCohort,
} from "@/lib/installPromptAnalytics";

const EVENTS_KEY = "kora-install-prompt-events";

describe("installPromptAnalytics", () => {
  beforeEach(() => {
    localStorage.removeItem(EVENTS_KEY);
    delete (window as unknown as Record<string, unknown>).gtag;
    delete (window as unknown as Record<string, unknown>).plausible;
    delete (window as unknown as Record<string, unknown>).__KORA_INSTALL_PROMPT_ANALYTICS__;
    Object.defineProperty(window.navigator, "doNotTrack", {
      value: null,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a shown event", () => {
    trackInstallPromptShown(1);
    const events = getLocalInstallPromptEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("install_prompt_shown");
    expect(events[0].visitCount).toBe(1);
  });

  it("records install and dismiss outcomes", () => {
    trackInstallPromptAccepted(2);
    trackInstallPromptDismissed(3);
    expect(getLocalInstallPromptEvents().map((e) => e.name)).toEqual([
      "install_prompt_accepted",
      "install_prompt_dismissed",
    ]);
  });

  it("carries no PII — only cohort, visit count and timestamp", () => {
    trackInstallPromptAccepted(1);
    const [event] = getLocalInstallPromptEvents();
    expect(Object.keys(event).sort()).toEqual([
      "cohort",
      "name",
      "timestamp",
      "visitCount",
    ]);
  });

  it("segments cohort by route", () => {
    expect(detectInstallCohort("/dashboard/sme")).toBe("sme");
    expect(detectInstallCohort("/marketplace")).toBe("investor");
    expect(detectInstallCohort("/about")).toBe("unknown");
  });

  it("records a failed event when prompt() rejects", () => {
    trackInstallPromptFailed(4);
    const events = getLocalInstallPromptEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("install_prompt_failed");
    expect(events[0].visitCount).toBe(4);
  });

  it("emits expected event names for every outcome", () => {
    trackInstallPromptShown(1);
    trackInstallPromptAccepted(1);
    trackInstallPromptDismissed(1);
    trackInstallPromptFailed(1);
    expect(getLocalInstallPromptEvents().map((e) => e.name)).toEqual([
      "install_prompt_shown",
      "install_prompt_accepted",
      "install_prompt_dismissed",
      "install_prompt_failed",
    ]);
  });

  it("forwards events to window.gtag when present", () => {
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    trackInstallPromptAccepted(2);
    expect(gtag).toHaveBeenCalledTimes(1);
    const [command, eventName, params] = gtag.mock.calls[0];
    expect(command).toBe("event");
    expect(eventName).toBe("install_prompt_accepted");
    expect(params).toMatchObject({ visit_count: 2 });
  });

  it("forwards events to window.plausible when present", () => {
    const plausible = vi.fn();
    (window as unknown as Record<string, unknown>).plausible = plausible;
    trackInstallPromptDismissed(3);
    expect(plausible).toHaveBeenCalledTimes(1);
    const [eventName, options] = plausible.mock.calls[0];
    expect(eventName).toBe("install_prompt_dismissed");
    expect(options).toMatchObject({ props: { visit_count: 3 } });
  });

  it("does not leak PII (URL, wallet, user agent) into the payload", () => {
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    trackInstallPromptShown(1);
    const [, , params] = gtag.mock.calls[0];
    const serialized = JSON.stringify(params).toLowerCase();
    expect(serialized).not.toContain("http");
    expect(serialized).not.toContain("wallet");
    expect(serialized).not.toContain("useragent");
    expect(serialized).not.toContain("user-agent");
    expect(serialized).not.toContain(window.location.href.toLowerCase());
    const [event] = getLocalInstallPromptEvents();
    expect(Object.keys(event).sort()).toEqual([
      "cohort",
      "name",
      "timestamp",
      "visitCount",
    ]);
  });

  it("does not emit when the analytics env flag is disabled", () => {
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    (window as unknown as Record<string, unknown>).__KORA_INSTALL_PROMPT_ANALYTICS__ = false;
    trackInstallPromptShown(1);
    expect(gtag).not.toHaveBeenCalled();
    expect(getLocalInstallPromptEvents()).toHaveLength(0);
  });

  it("respects Do Not Track", () => {
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    Object.defineProperty(window.navigator, "doNotTrack", {
      value: "1",
      configurable: true,
    });
    trackInstallPromptAccepted(1);
    expect(gtag).not.toHaveBeenCalled();
    expect(getLocalInstallPromptEvents()).toHaveLength(0);
  });
});
