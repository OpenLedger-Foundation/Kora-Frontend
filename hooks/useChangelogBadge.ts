"use client";

import { useCallback, useEffect, useState } from "react";
import { useUIStore } from "@/store/uiStore";
import { parseChangelog } from "@/hooks/useChangelog";

const SEEN_KEY = "kora-changelog-seen-version";

// Clock skew tolerance: a release dated slightly in the future (e.g. a build
// machine whose clock runs ahead, or a timezone boundary) should not be
// treated as unread forever. Anything within this window is considered
// "already released" for unread purposes.
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

function readSeenVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    // Private mode or blocked storage — treat as "nothing seen yet" and let
    // the fail-closed rule below decide whether to show anything.
    return null;
  }
}

/**
 * Parse a changelog release date into a timestamp, tolerating the common
 * formats used in CHANGELOG.md (ISO `YYYY-MM-DD`, and locale-ish
 * `Month D, YYYY`). Returns null when the date cannot be understood so the
 * caller can fail closed rather than guess.
 */
function parseReleaseDate(date: string | undefined | null): number | null {
  if (!date) return null;
  const trimmed = date.trim();
  if (!trimmed) return null;

  // ISO date (optionally with time). `Date.parse` handles this reliably and
  // is locale-independent, which is what we want for comparison.
  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return iso;

  return null;
}

/**
 * Tracks whether the newest release in CHANGELOG.md has been seen (Issue #679).
 *
 * `useChangelog` already stores the seen version, but it only drives the
 * auto-opening modal — nothing surfaced an unread release once that modal had
 * been dismissed, so users only found releases via the footer link.
 *
 * Unread semantics (Issue #1159):
 * - A release is unread when its version differs from the last seen version
 *   AND its date is not in the future beyond the clock-skew tolerance.
 * - Dates are compared as timestamps (locale-independent) so the badge is
 *   consistent across locales; only display formatting is locale-aware.
 *
 * Fails closed: if the changelog cannot be fetched or parses to nothing, there
 * is no version to compare against, so no badge is shown. A dot that might be
 * pointing at nothing is worse than no dot.
 */
export function useChangelogBadge() {
  const changelogOpen = useUIStore((s) => s.changelogOpen);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [latestDate, setLatestDate] = useState<string | null>(null);
  const [seenVersion, setSeenVersion] = useState<string | null>(null);

  useEffect(() => {
    setSeenVersion(readSeenVersion());
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/CHANGELOG.md")
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const releases = parseChangelog(text);
        // parseChangelog skips [Unreleased], so releases[0] is the newest
        // published version.
        const newest = releases[0];
        setLatestVersion(newest?.version ?? null);
        setLatestDate(newest?.date ?? null);
      })
      .catch(() => {
        // Fail closed — leave latestVersion null so no badge renders.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Record the latest version as seen and drop the badge. */
  const markSeen = useCallback(() => {
    if (!latestVersion) return;
    try {
      localStorage.setItem(SEEN_KEY, latestVersion);
    } catch {
      // Storage unavailable: the badge still clears for this session.
    }
    setSeenVersion(latestVersion);
  }, [latestVersion]);

  // Opening the modal is what "reading the changelog" means, however it was
  // opened — the navbar button, the footer link, or the auto-open on a new
  // version.
  useEffect(() => {
    if (changelogOpen) markSeen();
  }, [changelogOpen, markSeen]);

  // A release dated in the future (beyond clock-skew tolerance) is not yet
  // "out", so it must not raise the unread badge. Undated releases fall back
  // to the version comparison alone.
  const releaseTs = parseReleaseDate(latestDate);
  const isReleased =
    releaseTs === null || releaseTs <= Date.now() + CLOCK_SKEW_MS;

  return {
    hasUnread:
      latestVersion !== null && latestVersion !== seenVersion && isReleased,
    latestVersion,
    latestDate,
    markSeen,
  };
}
