"use client";

import { useEffect, useState } from "react";

export function useRovingTabIndex(itemCount: number) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (itemCount === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, itemCount - 1));
  }, [itemCount]);

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
  };
}
