"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getMediaDetails } from "@/services/media";
import type { MovieOrShow } from "@/types/media";

/**
 * useMediaDetails — fetch a single TMDB movie or series by id.
 *
 * `isTV` switches between /movies/:id and /tv/:id on the backend.
 * Returns the same queryKey shape as legacy useEffect-based code so that
 * caching, retry and invalidation all work without custom wiring.
 */
export function useMediaDetails(
  id: string | undefined,
  isTV = false,
  options?: Omit<UseQueryOptions<MovieOrShow | null>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["media-details", id, isTV] as const,
    queryFn: ({ signal }) => getMediaDetails(id as string, isTV, signal),
    enabled: !!id,
    staleTime: 5 * 60_000,
    ...options,
  });
}