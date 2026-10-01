"use client";

import { useQuery } from "@tanstack/react-query";
import { getMovieGenres } from "@/services/media";
import type { Genre } from "@/types/media";

/** Fetch the movie genre list. Cached aggressively (genres rarely change). */
export function useMovieGenres(options?: { enabled?: boolean }) {
  return useQuery<Genre[]>({
    queryKey: ["genres-movie"] as const,
    queryFn: ({ signal }) => getMovieGenres(signal),
    staleTime: 30 * 60_000,
    enabled: options?.enabled !== false,
  });
}