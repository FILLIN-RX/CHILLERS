"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getStreamUrl, getNexStreamUrl } from "@/services/media";

export type StreamMediaType = "movie" | "series" | "anime";

export interface UseStreamUrlArgs {
  id: string;
  type: StreamMediaType;
  season?: number;
  episode?: number;
  title?: string;
  /** Disable the request entirely (e.g. when the page isn't ready). */
  enabled?: boolean;
  /** Stale time (ms) before the cached URL is considered stale and refetched. */
  staleTimeMs?: number;
}

export interface StreamResolution {
  embedUrl: string;
  provider: "primary" | "secondary";
}

const PRIMARY_TIMEOUT_MS = 8_000;
const SECONDARY_TIMEOUT_MS = 6_000;

function buildKey(args: UseStreamUrlArgs) {
  return [
    "streamUrl",
    args.id,
    args.type,
    args.season ?? "_",
    args.episode ?? "_",
  ] as const;
}

interface RaceContext {
  queryClient: QueryClient;
  cacheKey: readonly unknown[];
}

/**
 * Race the primary provider against the secondary provider, return whichever
 * resolves first with a usable URL. If both fail, return `null`.
 *
 * Implementation detail: we only short-circuit when a provider resolves with
 * a usable URL, NOT when it fails/times-out — otherwise a single broken
 * upstream would block the other one for the full timeout. The loser is
 * allowed to keep running in the background and we cache its result so the
 * *next* navigation starts instantly.
 */
async function raceProviders(
  args: UseStreamUrlArgs,
  ctx: RaceContext,
  signal: AbortSignal,
): Promise<StreamResolution | null> {
  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race<T | null>([
      p,
      new Promise<T | null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);

  const backgroundCache = (resolution: StreamResolution | null) => {
    if (!resolution) return;
    // Don't overwrite a fresher primary result with a slower secondary one.
    const existing = ctx.queryClient.getQueryData<StreamResolution | null>(ctx.cacheKey);
    if (!existing || existing.provider === "secondary") {
      ctx.queryClient.setQueryData(ctx.cacheKey, resolution);
    }
  };

  const primaryPromise = withTimeout(
    getStreamUrl(args.id, args.type, args.season, args.episode, args.title, signal)
      .then<StreamResolution | null>((res) => (res ? { embedUrl: res.embedUrl, provider: "primary" as const } : null))
      .catch(() => null),
    PRIMARY_TIMEOUT_MS,
  ).then((r) => {
    backgroundCache(r);
    return r;
  });

  const secondaryPromise = withTimeout(
    getNexStreamUrl(args.id, args.type, args.season, args.episode)
      .then<StreamResolution | null>((url) => (url ? { embedUrl: url, provider: "secondary" as const } : null))
      .catch(() => null),
    SECONDARY_TIMEOUT_MS,
  ).then((r) => {
    backgroundCache(r);
    return r;
  });

  // First non-null wins. We poll both promises so the moment one resolves
  // we return immediately; the other is left running in the background to
  // warm the cache via `backgroundCache`.
  const winner = await new Promise<StreamResolution | null>((resolve) => {
    let settled = false;
    const settle = (val: StreamResolution | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    primaryPromise.then((r) => {
      if (r) settle(r);
    });
    secondaryPromise.then((r) => {
      if (r) settle(r);
    });
    // Last-resort: if both timed out without resolving to a usable URL,
    // surface null after the slower timeout.
    setTimeout(
      () => settle(null),
      Math.max(PRIMARY_TIMEOUT_MS, SECONDARY_TIMEOUT_MS) + 250,
    );
  });

  return winner;
}

/**
 * useStreamUrl — resolves a playable URL for a movie/episode.
 *
 * Wraps the primary/secondary provider race in a TanStack Query cache so a
 * user navigating back to the same episode (e.g. closing the player then
 * reopening) does NOT re-hit the backend: the embed URL is cached for
 * `staleTimeMs` (default 5 minutes).
 *
 * Also exposes `prefetchNext` to warm the cache for the next episode as
 * soon as the current one starts playing.
 */
export function useStreamUrl(args: UseStreamUrlArgs) {
  const queryClient = useQueryClient();
  const enabled = args.enabled ?? true;
  const staleTimeMs = args.staleTimeMs ?? 5 * 60_000;
  const cacheKey = buildKey(args);

  const query = useQuery({
    queryKey: cacheKey,
    queryFn: async ({ signal }) => raceProviders(args, { queryClient, cacheKey }, signal),
    enabled: enabled && !!args.id,
    staleTime: staleTimeMs,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  /**
   * Warm the cache for the next episode (or movie in the same franchise).
   * Call from the player's progress callback once we're ~50% in.
   */
  const prefetchNext = async (
    next: Omit<UseStreamUrlArgs, "enabled" | "staleTimeMs">,
  ) => {
    const nextKey = buildKey(next);
    await queryClient.prefetchQuery({
      queryKey: nextKey,
      queryFn: async ({ signal }) => raceProviders(next, { queryClient, cacheKey: nextKey }, signal),
      staleTime: staleTimeMs,
    });
  };

  // Touch `enabled` so it counts as a dependency for linting even though
  // the query object already handles it.
  useEffect(() => {
    /* no-op */
  }, [enabled]);

  return { ...query, prefetchNext };
}
