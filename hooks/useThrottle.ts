import { useState, useEffect, useRef } from "react";

/**
 * Returns a throttled copy of `value` — updates at most once per `interval` ms.
 * Uses a trailing-edge update so the final value is always emitted.
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttled, setThrottled] = useState<T>(value);
  const lastUpdated = useRef<number>(-Infinity);
  const trailingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const remaining = interval - (now - lastUpdated.current);

    if (remaining <= 0) {
      if (trailingTimer.current) {
        clearTimeout(trailingTimer.current);
        trailingTimer.current = null;
      }
      lastUpdated.current = now;
      setThrottled(value);
    } else {
      if (trailingTimer.current) clearTimeout(trailingTimer.current);
      trailingTimer.current = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottled(value);
        trailingTimer.current = null;
      }, remaining);
    }

    return () => {
      if (trailingTimer.current) clearTimeout(trailingTimer.current);
    };
  }, [value, interval]);

  return throttled;
}

export default useThrottle;
