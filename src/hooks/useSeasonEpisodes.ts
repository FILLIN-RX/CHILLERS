"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getSeasonDetails } from "@/services/media";
import type { SeasonDetails } from "@/types/media";

/**
 * useSeasonEpisodes — fetch the episodes of a given season for a TV show.
 */
export function useSeasonEpisodes(
  id: string | undefined,
  seasonNumber: string | number | undefined,
  options?: Omit<UseQueryOptions<SeasonDetails | null>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["season-episodes", id, seasonNumber] as const,
    queryFn: ({ signal }) => getSeasonDetails(id as string, String(seasonNumber), signal),
    enabled: !!id && seasonNumber !== undefined && seasonNumber !== null,
    staleTime: 10 * 60_000,
    ...options,
  });
}