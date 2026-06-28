import { cn } from "@/lib/utils";

interface ShortcutBadgeProps {
  keys: string;
  className?: string;
}

/**
 * ShortcutBadge
 *
 * Renders a small keyboard shortcut hint badge, e.g. "⌘K".
 * Intended to be placed alongside buttons or nav items.
 */
export function ShortcutBadge({ keys, className }: ShortcutBadgeProps) {
  return (
    <kbd
      aria-label={`Keyboard shortcut: ${keys}`}
      className={cn(
        "hidden items-center rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex",
        className
      )}
    >
      {keys}
    </kbd>
  );
}
