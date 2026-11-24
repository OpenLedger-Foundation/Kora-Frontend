"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseRovingTabIndexOptions {
  /**
   * Called when Enter or Space is pressed on an item. Receives the index of
   * the item that was activated. Space is only intercepted when this handler
   * is provided so that it does not interfere with native button activation.
   */
  onActivate?: (index: number) => void;
  /**
   * Called when Delete or Backspace is pressed on an item. Receives the index
   * of the item that was removed. After removal, focus is restored to a
   * sensible neighbour once `itemCount` shrinks.
   */
  onRemove?: (index: number) => void;
}

/**
 * Roving tabindex for a one-dimensional group of related controls (toggle
 * buttons, checkboxes, etc.) — arrow keys move focus within the group,
 * Home/End jump to the first/last item, and only one item is a Tab stop at
 * a time. Standard WAI-ARIA pattern for a toolbar/group of related filter
 * controls (#440): without it, each filter chip is its own Tab stop, so
 * tabbing through a 10-item jurisdiction list takes 10 presses instead of
 * one Tab in + arrow keys + one Tab out.
 *
 * Also exposes `activeIndex` / `move` for marketplace keyboard comparison
 * multi-select that manages focus externally.
 */
export function useRovingTabIndex(
  itemCount: number,
  options: UseRovingTabIndexOptions = {}
) {
  const { onActivate, onRemove } = options;
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  // When a chip is removed we want focus to land on its neighbour rather than
  // being lost to <body>. We remember the index to focus once the list has
  // re-rendered with the new (smaller) itemCount.
  const pendingFocusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (itemCount === 0) {
      setActiveIndex(0);
      pendingFocusIndex.current = null;
      return;
    }

    if (pendingFocusIndex.current !== null) {
      const target = Math.min(pendingFocusIndex.current, itemCount - 1);
      pendingFocusIndex.current = null;
      setActiveIndex(target);
      itemRefs.current[target]?.focus();
      return;
    }

    setActiveIndex((current) => Math.min(current, itemCount - 1));
  }, [itemCount]);

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
        case "Enter":
          if (onActivate) {
            event.preventDefault();
            onActivate(index);
          }
          break;
        case " ":
        case "Spacebar":
          if (onActivate) {
            event.preventDefault();
            onActivate(index);
          }
          break;
        case "Delete":
        case "Backspace":
          if (onRemove) {
            event.preventDefault();
            // Focus the item that will slide into this slot, or the previous
            // one when removing the last item in the list.
            pendingFocusIndex.current = Math.max(
              0,
              Math.min(index, itemCount - 2)
            );
            onRemove(index);
          }
          break;
        default:
          break;
      }
    },
    [focusItem, itemCount, onActivate, onRemove]
  );

  const getTabIndex = useCallback(
    (index: number) => (index === activeIndex ? 0 : -1),
    [activeIndex]
  );

  const move = (direction: "next" | "prev" | "first" | "last") => {
    setActiveIndex((current) => {
      if (itemCount === 0) return 0;
      switch (direction) {
        case "first":
          return 0;
        case "last":
          return itemCount - 1;
        case "next":
          return Math.min(current + 1, itemCount - 1);
        case "prev":
          return Math.max(current - 1, 0);
      }
    });
  };

  return {
    activeIndex,
    setActiveIndex,
    move,
    registerRef,
    handleKeyDown,
    getTabIndex,
  };
}
