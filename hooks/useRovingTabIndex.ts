"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Roving tabindex for a one-dimensional group of related controls (toggle
 * buttons, checkboxes, etc.) — arrow keys move focus within the group,
 * Home/End jump to the first/last item, and only one item is a Tab stop at
 * a time. Standard WAI-ARIA pattern for a toolbar/group of related filter
 * controls (#440): without it, each filter chip is its own Tab stop, so
 * tabbing through a 10-item jurisdiction list takes 10 presses instead of
 * one Tab in + arrow keys + one Tab out.
 */
export function useRovingTabIndex(itemCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const registerRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    []
  );

  const focusItem = useCallback(
    (index: number) => {
      if (itemCount === 0) return;
      const clamped = ((index % itemCount) + itemCount) % itemCount;
      setActiveIndex(clamped);
      itemRefs.current[clamped]?.focus();
    },
    [itemCount]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          focusItem(index + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          focusItem(index - 1);
          break;
        case "Home":
          event.preventDefault();
          focusItem(0);
          break;
        case "End":
          event.preventDefault();
          focusItem(itemCount - 1);
          break;
        default:
          break;
      }
    },
    [focusItem, itemCount]
  );

  const getTabIndex = useCallback(
    (index: number) => (index === activeIndex ? 0 : -1),
    [activeIndex]
  );

  return { registerRef, handleKeyDown, getTabIndex, setActiveIndex };
}
