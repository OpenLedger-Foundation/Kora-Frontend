import { useState, useEffect } from "react";
import { useDebouncedCallback } from "./useDebouncedCallback";

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity. The pending update is cancelled on unmount.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  const update = useDebouncedCallback((next: T) => setDebounced(() => next), delay);

  useEffect(() => {
    update(value);
    return update.cancel;
  }, [value, update]);

  return debounced;
}

export default useDebounce;
