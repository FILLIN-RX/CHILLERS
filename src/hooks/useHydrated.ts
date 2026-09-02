"use client";

import { useState, useEffect } from "react";

/**
 * Returns `true` after the component has mounted on the client.
 *
 * Use this to defer rendering of parts of the tree that depend on
 * client-only state (localStorage, Zustand persist, window.*, etc.)
 * so the server HTML always matches the first client paint.
 *
 * On the server and during the very first client render this returns `false`.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
