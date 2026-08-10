"use client";

import { useQuery } from "@tanstack/react-query";
import { getMovieGenres, getTVGenres } from "@/services/media";
import type { Genre } from "@/types/media";

/**
 * useGenres — fetch both movie and TV genres in parallel.
 */
export function useGenres() {
  const movie = useQuery({
    queryKey: ["genres", "movie"] as const,
    queryFn: ({ signal }) => getMovieGenres(signal),
    staleTime: 30 * 60_000,
  });
  const tv = useQuery({
    queryKey: ["genres", "tv"] as const,
    queryFn: ({ signal }) => getTVGenres(signal),
    staleTime: 30 * 60_000,
  });

  return {
    movieGenres: (movie.data ?? []) as Genre[],
    tvGenres: (tv.data ?? []) as Genre[],
    isLoading: movie.isLoading || tv.isLoading,
  };
}