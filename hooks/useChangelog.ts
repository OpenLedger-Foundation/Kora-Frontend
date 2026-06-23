"use client";

import { useCallback, useEffect, useState } from "react";
import { useUIStore } from "@/store/uiStore";

const SEEN_KEY = "kora-changelog-seen-version";

export interface ChangelogSection {
  type: "features" | "fixes" | "breaking" | "other";
  label: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

// ─── Simple CHANGELOG.md parser ──────────────────────────────────────────────
// Parses Keep-a-Changelog format:
//   ## [x.y.z] - YYYY-MM-DD
//   ### Added / Fixed / Changed / Breaking Changes / etc.
//   - item

function parseSectionType(heading: string): ChangelogSection["type"] {
  const h = heading.toLowerCase();
  if (h.includes("break")) return "breaking";
  if (h.includes("fix") || h.includes("bug")) return "fixes";
  if (h.includes("add") || h.includes("new") || h.includes("feat")) return "features";
  return "other";
}

function parseSectionLabel(heading: string): string {
  const h = heading.toLowerCase();
  if (h.includes("break")) return "Breaking Changes";
  if (h.includes("fix") || h.includes("bug")) return "Bug Fixes";
  if (h.includes("add") || h.includes("new") || h.includes("feat")) return "New Features";
  return heading.trim();
}

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  const lines = markdown.split("\n");

  let current: ChangelogRelease | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // ## [version] - date  OR  ## [Unreleased]
    const releaseMatch = line.match(/^##\s+\[([^\]]+)\](?:\s+-\s+(\S+))?/);
    if (releaseMatch) {
      if (currentSection && current) current.sections.push(currentSection);
      if (current) releases.push(current);
      currentSection = null;
      const version = releaseMatch[1];
      if (version.toLowerCase() === "unreleased") {
        current = null;
        continue;
      }
      current = { version, date: releaseMatch[2] ?? "", sections: [] };
      continue;
    }

    if (!current) continue;

    // ### Section heading
    const sectionMatch = line.match(/^###\s+(.+)/);
    if (sectionMatch) {
      if (currentSection) current.sections.push(currentSection);
      currentSection = {
        type: parseSectionType(sectionMatch[1]),
        label: parseSectionLabel(sectionMatch[1]),
        items: [],
      };
      continue;
    }

    // - list item
    const itemMatch = line.match(/^[-*]\s+(.+)/);
    if (itemMatch) {
      if (!currentSection) {
        currentSection = { type: "other", label: "Changes", items: [] };
      }
      currentSection.items.push(itemMatch[1]);
      continue;
    }

    // Plain paragraph text — treat as an "other" item
    if (line.trim() && !line.startsWith("#") && current) {
      if (!currentSection) {
        currentSection = { type: "other", label: "Changes", items: [] };
      }
      currentSection.items.push(line.trim());
    }
  }

  // Flush last section/release
  if (currentSection && current) current.sections.push(currentSection);
  if (current) releases.push(current);

  return releases;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChangelog(appVersion: string) {
  const changelogOpen = useUIStore((s) => s.changelogOpen);
  const setChangelogOpen = useUIStore((s) => s.setChangelogOpen);
  const [autoOpen, setAutoOpen] = useState(false);

  // On mount: show modal if this version hasn't been seen yet
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen !== appVersion) {
      setAutoOpen(true);
    }
  }, [appVersion]);

  const dismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SEEN_KEY, appVersion);
    }
    setAutoOpen(false);
    setChangelogOpen(false);
  }, [appVersion, setChangelogOpen]);

  return {
    isOpen: autoOpen || changelogOpen,
    dismiss,
  };
}
