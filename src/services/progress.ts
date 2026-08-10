// Continue-watching persistence service. localStorage first, backend second.
//
// The backend endpoint /api/progress is added by the backend team as part of Phase 5
// of the refactor. Until that endpoint exists, the network call silently fails and
// the localStorage path keeps working.

import { API_BASE_PATH } from "./http";
import type { ProgressEntry } from "@/types/player";

const KEY_PREFIX = "chiller_progress_";

export function progressKey(itemId: string, episodeId: string | number | null | undefined): string {
  return `${KEY_PREFIX}${itemId}_${episodeId ?? "movie"}`;
}

export function loadProgress(
  itemId: string,
  episodeId: string | number | null | undefined,
): ProgressEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(progressKey(itemId, episodeId));
    if (!raw) return null;
    return JSON.parse(raw) as ProgressEntry;
  } catch {
    return null;
  }
}

export function saveProgress(entry: ProgressEntry): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progressKey(entry.id, entry.episodeId), JSON.stringify(entry));
  } catch {
    /* quota exceeded or storage disabled */
  }
}

export function clearProgress(itemId: string, episodeId: string | number | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(progressKey(itemId, episodeId));
  } catch {
    /* ignore */
  }
}

/**
 * Scan every progress entry in localStorage, sort by `updatedAt` desc, and return the top N.
 * Used by the homepage "Continue watching" carousel.
 */
export function listRecentProgress(limit = 12): ProgressEntry[] {
  if (typeof window === "undefined") return [];
  const out: ProgressEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as ProgressEntry);
      } catch {
        /* skip malformed entries */
      }
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

/* ─── optional backend sync (Phase 5 endpoint) ───────────────────────────── */

export async function pushProgressToBackend(entry: ProgressEntry): Promise<void> {
  try {
    await fetch(`${API_BASE_PATH}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      // keepalive ensures the request outlives a page navigation
      keepalive: true,
    });
  } catch {
    /* backend endpoint may not exist yet — silently fall back to local */
  }
}