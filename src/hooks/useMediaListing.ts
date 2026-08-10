"use client";

import { useQuery } from "@tanstack/react-query";
import { getPopularMoviesPage, getPopularTVPage, getAnimeSeriesPage, getMoviesByGenrePage, getTVByGenrePage } from "@/services/media";
import type { MovieOrShow } from "@/types/media";

export interface ListingParams {
  type: "popular-movies" | "popular-tv" | "anime" | "movie-genre" | "tv-genre";
  page?: number;
  genreId?: string;
}

export interface ListingResult {
  results: MovieOrShow[];
  totalPages: number;
}

/**
 * useMediaListing — paginated media listing with cache per (type, page, genre).
 *
 * Pages are kept in the cache (default 5 minutes) so navigating to the next page
 * and back doesn't refetch.
 */
export function useMediaListing(params: ListingParams) {
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ["media-listing", params.type, params.genreId ?? "", page] as const,
    queryFn: async ({ signal }): Promise<ListingResult> => {
      switch (params.type) {
        case "popular-movies":
          return getPopularMoviesPage(page, signal);
        case "popular-tv":
          return getPopularTVPage(page, signal);
        case "anime":
          return getAnimeSeriesPage(page, signal);
        case "movie-genre":
          return getMoviesByGenrePage(params.genreId as string, page, signal);
        case "tv-genre":
          return getTVByGenrePage(params.genreId as string, page, signal);
      }
    },
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}