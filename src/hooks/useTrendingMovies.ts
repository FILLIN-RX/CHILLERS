"use client";

import { useQuery } from "@tanstack/react-query";
import { getTrendingMovies } from "@/services/media";
import type { MovieOrShow } from "@/types/media";

/** Fetch trending movies, used by SearchOverlay and the home carousel. */
export function useTrendingMovies() {
  return useQuery<MovieOrShow[]>({
    queryKey: ["trending-movies"] as const,
    queryFn: ({ signal }) => getTrendingMovies(signal),
    staleTime: 60_000,
  });
}