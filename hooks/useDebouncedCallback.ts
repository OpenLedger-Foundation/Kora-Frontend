import { useCallback, useEffect, useRef } from "react";

export interface DebouncedCallback<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

/**
 * Returns a debounced version of `fn` that fires after `delay` ms of
 * inactivity. The returned function has a `.cancel()` method and the pending
 * call is automatically cancelled on unmount.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): DebouncedCallback<T> {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep fnRef current without re-creating the debounced wrapper
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cancel on unmount
  useEffect(() => cancel, [cancel]);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
        timerRef.current = null;
      }, delay);
    },
    [cancel, delay]
  ) as DebouncedCallback<T>;

  debounced.cancel = cancel;

  return debounced;
}

export default useDebouncedCallback;
