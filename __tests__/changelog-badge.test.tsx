/**
 * Tests for the changelog unread badge (Issue #679, #1159).
 *
 * useChangelog already stored the seen version, but nothing surfaced an unread
 * release once the auto-open modal had been dismissed. These cover the compare,
 * the clear-on-open, and the fail-closed rule — a dot that might be pointing at
 * nothing is worse than no dot at all.
 *
 * Issue #1159 adds locale-aware date handling: unread must stay accurate when
 * release dates are written in non-ISO / localized formats, and clock skew must
 * not resurrect a release that has already been seen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { useChangelogBadge } from "@/hooks/useChangelogBadge";
import { useUIStore } from "@/store/uiStore";

const SEEN_KEY = "kora-changelog-seen-version";

const CHANGELOG = `# Changelog

## [Unreleased]

### Added
- Something not released yet

## [1.4.0] - 2026-05-01

### Added
- Newest published release

## [1.3.0] - 2026-04-01

### Fixed
- Older release
`;

// Localized / non-ISO dates that must still order correctly.
const LOCALIZED_CHANGELOG = `# Changelog

## [2.0.0] - 1 de mayo de 2026

### Added
- Localized newest release

## [1.9.0] - 1 de abril de 2026

### Fixed
- Localized older release
`;

function mockChangelogFetch(body: string | null, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      text: () => Promise.resolve(body ?? ""),
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({ changelogOpen: false });
  mockChangelogFetch(CHANGELOG);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  useUIStore.setState({ changelogOpen: false });
});

describe("useChangelogBadge", () => {
  it("reports the newest published version, skipping Unreleased", async () => {
    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe("1.4.0"));
  });

  it("flags unread when nothing has been seen", async () => {
    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.hasUnread).toBe(true));
  });

  it("flags unread when the seen version is older than the latest", async () => {
    localStorage.setItem(SEEN_KEY, "1.3.0");
    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.hasUnread).toBe(true));
  });

  it("stays clear when the latest version has already been seen", async () => {
    localStorage.setItem(SEEN_KEY, "1.4.0");
    const { result } = renderHook(() => useChangelogBadge());

    await waitFor(() => expect(result.current.latestVersion).toBe("1.4.0"));
    expect(result.current.hasUnread).toBe(false);
  });

  describe("locale-aware dates", () => {
    it("orders localized release dates and reports the newest version", async () => {
      mockChangelogFetch(LOCALIZED_CHANGELOG);
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.latestVersion).toBe("2.0.0"));
    });

    it("flags unread for a localized release that has not been seen", async () => {
      mockChangelogFetch(LOCALIZED_CHANGELOG);
      localStorage.setItem(SEEN_KEY, "1.9.0");
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.hasUnread).toBe(true));
    });

    it("stays clear when the localized latest release has been seen", async () => {
      mockChangelogFetch(LOCALIZED_CHANGELOG);
      localStorage.setItem(SEEN_KEY, "2.0.0");
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.latestVersion).toBe("2.0.0"));
      expect(result.current.hasUnread).toBe(false);
    });
  });

  describe("clock skew", () => {
    it("does not flag unread for a release dated in the future once seen", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      localStorage.setItem(SEEN_KEY, "1.4.0");
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.latestVersion).toBe("1.4.0"));
      expect(result.current.hasUnread).toBe(false);
    });

    it("still flags unread for an unseen future-dated release", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      localStorage.setItem(SEEN_KEY, "1.3.0");
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.hasUnread).toBe(true));
    });
  });

  describe("clearing", () => {
    it("clears when the changelog modal opens", async () => {
      const { result } = renderHook(() => useChangelogBadge());
      await waitFor(() => expect(result.current.hasUnread).toBe(true));

      act(() => {
        useUIStore.getState().setChangelogOpen(true);
      });

      await waitFor(() => expect(result.current.hasUnread).toBe(false));
    });

    it("records the seen version so it stays clear on the next mount", async () => {
      const { result } = renderHook(() => useChangelogBadge());
      await waitFor(() => expect(result.current.hasUnread).toBe(true));

      act(() => {
        useUIStore.getState().setChangelogOpen(true);
      });
      await waitFor(() => expect(localStorage.getItem(SEEN_KEY)).toBe("1.4.0"));

      useUIStore.setState({ changelogOpen: false });
      const second = renderHook(() => useChangelogBadge());
      await waitFor(() => expect(second.result.current.latestVersion).toBe("1.4.0"));
      expect(second.result.current.hasUnread).toBe(false);
    });

    it("markSeen clears it without opening the modal", async () => {
      const { result } = renderHook(() => useChangelogBadge());
      await waitFor(() => expect(result.current.hasUnread).toBe(true));

      act(() => {
        result.current.markSeen();
      });

      await waitFor(() => expect(result.current.hasUnread).toBe(false));
    });
  });

  describe("fails closed", () => {
    it("shows nothing when the changelog cannot be fetched", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.latestVersion).toBeNull());
      expect(result.current.hasUnread).toBe(false);
    });

    it("shows nothing on a non-ok response", async () => {
      mockChangelogFetch(null, false);
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.latestVersion).toBeNull());
      expect(result.current.hasUnread).toBe(false);
    });

    it("shows nothing when the markdown parses to no releases", async () => {
      mockChangelogFetch("# Changelog\n\nNothing structured here.\n");
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.latestVersion).toBeNull());
      expect(result.current.hasUnread).toBe(false);
    });

    it("shows nothing when the file holds only an Unreleased section", async () => {
      mockChangelogFetch("# Changelog\n\n## [Unreleased]\n\n### Added\n- pending\n");
      const { result } = renderHook(() => useChangelogBadge());

      await waitFor(() => expect(result.current.latestVersion).toBeNull());
      expect(result.current.hasUnread).toBe(false);
    });

    it("does not write a seen version when there is no release to record", async () => {
      mockChangelogFetch("# Changelog\n");
      const { result } = renderHook(() => useChangelogBadge());
      await waitFor(() => expect(result.current.latestVersion).toBeNull());

      act(() => {
        result.current.markSeen();
      });

      expect(localStorage.getItem(SEEN_KEY)).toBeNull();
    });
  });
});
