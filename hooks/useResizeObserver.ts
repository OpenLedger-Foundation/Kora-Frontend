import { useState, useEffect, useRef, RefObject } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Observes the dimensions of the element referenced by `ref`.
 * Updates are throttled to 100 ms to avoid excessive re-renders.
 * The observer is disconnected on unmount.
 */
export function useResizeObserver(ref: RefObject<Element | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ElementSize | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      pendingRef.current = { width, height };

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (pendingRef.current) setSize(pendingRef.current);
        timerRef.current = null;
      }, 100);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ref]);

  return size;
}

export default useResizeObserver;
