"use client";

import { useEffect, useRef } from "react";

/**
 * useDebouncedEffect — like `useEffect`, but the callback only fires after
 * the dependencies have been stable for `delay` ms. If deps change again
 * before the timer fires, the previous call is cancelled.
 *
 * Use to throttle expensive side-effects (localStorage writes, network
 * calls, layout reads) that would otherwise be triggered on every keystroke
 * or `onTimeUpdate` tick.
 *
 * The returned cleanup function from the callback fires when the debounced
 * timer finally does fire and then again on unmount.
 */
export function useDebouncedEffect<T extends readonly unknown[]>(
  effect: () => void | (() => void),
  deps: T,
  delay: number,
): void {
  const cleanupRef = useRef<(() => void) | void>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const ret = effect();
      cleanupRef.current = ret;
    }, delay);

    return () => {
      // On dep change or unmount: cancel pending timer + run the cleanup.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      } else if (cleanupRef.current) {
        const cb = cleanupRef.current;
        cleanupRef.current = undefined;
        cb();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
