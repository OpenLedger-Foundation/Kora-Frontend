"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps keyboard focus anchored while an infinite list appends pages.
 *
 * Appending rows never *moves* focus by itself, but two things can still lose
 * it: a re-render that drops focus to `<body>`, and the browser resetting focus
 * to the top of the document. This hook remembers the last meaningful focus
 * target and, whenever `itemCount` changes, restores it *only if focus was
 * lost*. It never moves focus forward onto the newly loaded cards, so a user
 * reading mid-list keeps their place across batches.
 */
export function useLoadMoreFocus(itemCount: number) {
  const lastFocused = useRef<HTMLElement | null>(null);

  // Track real focus moves (not just renders) so we know where the user was.
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target !== document.body && target.isConnected) {
        lastFocused.current = target;
      }
    };
    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, []);

  // A new batch landed: put focus back only when it was dropped.
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    if ((!active || active === document.body) && lastFocused.current?.isConnected) {
      lastFocused.current.focus();
    }
  }, [itemCount]);

  return lastFocused;
}

export default useLoadMoreFocus;
