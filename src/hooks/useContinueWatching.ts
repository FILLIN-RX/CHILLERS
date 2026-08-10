"use client";

import { useEffect, useState } from "react";
import { listRecentProgress } from "@/services/progress";
import type { ProgressEntry } from "@/types/player";

/**
 * useContinueWatching — returns the list of recent resume entries from localStorage,
 * refreshed when the window regains focus and when the returned `refresh()` is called.
 *
 * Backed by a plain useEffect+useState rather than react-query because the data is
 * synchronous localStorage and is invalidated imperatively (no remote cache to bust).
 */
export function useContinueWatching(limit = 12) {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);

  const refresh = () => {
    if (typeof window === "undefined") return;
    setEntries(listRecentProgress(limit));
  };

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("chiller_progress_")) refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [limit]);

  return { entries, refresh };
}