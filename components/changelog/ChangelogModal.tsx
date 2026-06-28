"use client";

import * as React from "react";
import { Sparkles, Bug, AlertTriangle, List, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChangelog, parseChangelog } from "@/hooks/useChangelog";
import type { ChangelogSection, ChangelogRelease } from "@/hooks/useChangelog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Raw CHANGELOG.md content (inlined at build time) ────────────────────────
// We import the raw markdown string. Next.js supports raw file imports via
// webpack's asset/source loader when configured, but for simplicity we inline
// the content here and keep it in sync with CHANGELOG.md via the hook.
// In a real build pipeline you'd use:  import changelog from "!!raw-loader!@/../../CHANGELOG.md"
// For now we fetch it client-side from the public folder (copy is placed there by build).

const APP_VERSION = "0.1.0"; // Keep in sync with package.json

// ─── Section styling ──────────────────────────────────────────────────────────

const SECTION_CONFIG: Record<
  ChangelogSection["type"],
  { icon: React.ElementType; color: string; bg: string; border: string }
> = {
  features: {
    icon: Sparkles,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  fixes: {
    icon: Bug,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
  },
  breaking: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
  },
  other: {
    icon: List,
    color: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
  },
};

// ─── Release card ─────────────────────────────────────────────────────────────

function ReleaseCard({ release, isLatest }: { release: ChangelogRelease; isLatest: boolean }) {
  return (
    <div className="space-y-3">
      {/* Version header */}
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="font-semibold text-foreground">v{release.version}</span>
        {isLatest && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Latest
          </span>
        )}
        {release.date && (
          <span className="ml-auto text-xs text-muted-foreground">{release.date}</span>
        )}
      </div>

      {/* Sections */}
      {release.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground pl-6">No details available.</p>
      ) : (
        release.sections.map((section, i) => {
          const cfg = SECTION_CONFIG[section.type];
          const Icon = cfg.icon;
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3 space-y-2",
                cfg.bg,
                cfg.border
              )}
            >
              <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", cfg.color)}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {section.label}
              </div>
              <ul className="space-y-1 pl-1">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", cfg.color.replace("text-", "bg-"))} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ChangelogModal() {
  const { isOpen, dismiss } = useChangelog(APP_VERSION);
  const [releases, setReleases] = React.useState<ChangelogRelease[]>([]);

  // Fetch and parse CHANGELOG.md
  React.useEffect(() => {
    if (!isOpen) return;
    fetch("/CHANGELOG.md")
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (text) setReleases(parseChangelog(text));
      })
      .catch(() => {
        // Fallback: show a minimal entry from the known version
        setReleases([
          {
            version: APP_VERSION,
            date: "2026-05-18",
            sections: [
              {
                type: "features",
                label: "New Features",
                items: ["Initial public scaffold of the Kora-Frontend repository."],
              },
            ],
          },
        ]);
      });
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base">What&apos;s New</DialogTitle>
              <DialogDescription className="text-xs">
                Kora Protocol · v{APP_VERSION}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable release notes */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 overscroll-contain">
          {releases.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading release notes…
            </div>
          ) : (
            releases.map((release, i) => (
              <ReleaseCard key={release.version} release={release} isLatest={i === 0} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            You&apos;re on the latest version.
          </p>
          <Button onClick={dismiss} size="sm">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
