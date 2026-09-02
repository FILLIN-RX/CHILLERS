"use client";

import { useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { getTrendingMovies, getTrendingTV, getPopularMovies, getPopularTV, getAnimeSeries } from "@/services/media";
import { useSplashStore } from "@/stores/useSplashStore";
import type { MovieOrShow } from "@/types/media";

export interface HomeData {
  trendingMovies: MovieOrShow[];
  trendingTV: MovieOrShow[];
  popularMovies: MovieOrShow[];
  popularTV: MovieOrShow[];
  anime: MovieOrShow[];
}

/**
 * useHomeData — fan-out query for the homepage rows. Runs all five fetches
 * in parallel via useQueries and returns an aggregate result. Each entry
 * is independently cached, so the next visit only refetches stale ones.
 * Also signals the SplashStore when the first batch of data is ready.
 */
export function useHomeData() {
  const setReady = useSplashStore((s) => s.setReady);

  const results = useQueries({
    queries: [
      { queryKey: ["home", "trending-movies"] as const, queryFn: ({ signal }) => getTrendingMovies(signal), staleTime: 60_000 },
      { queryKey: ["home", "trending-tv"] as const, queryFn: ({ signal }) => getTrendingTV(signal), staleTime: 60_000 },
      { queryKey: ["home", "popular-movies"] as const, queryFn: ({ signal }) => getPopularMovies(1, signal), staleTime: 60_000 },
      { queryKey: ["home", "popular-tv"] as const, queryFn: ({ signal }) => getPopularTV(1, signal), staleTime: 60_000 },
      { queryKey: ["home", "anime"] as const, queryFn: ({ signal }) => getAnimeSeries(1, signal), staleTime: 60_000 },
    ],
  });

  // Dès que la première query renvoie des données, on peut cacher le splash
  const hasAnyData = results.some((r) => r.data !== undefined);
  const isAllSettled = results.every((r) => !r.isLoading);

  useEffect(() => {
    if (hasAnyData || isAllSettled) {
      setReady(true);
    }
  }, [hasAnyData, isAllSettled, setReady]);

  return {
    data: {
      trendingMovies: results[0].data ?? [],
      trendingTV: results[1].data ?? [],
      popularMovies: results[2].data ?? [],
      popularTV: results[3].data ?? [],
      anime: results[4].data ?? [],
    } as HomeData,
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
    errors: results.map((r) => r.error),
    refetch: () => results.forEach((r) => r.refetch()),
  };
}