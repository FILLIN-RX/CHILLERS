"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { searchMedia } from "@/services/media";
import type { MovieOrShow } from "@/types/media";

/**
 * useSearchSuggestions — debounced TMDB search.
 *
 * Returns the latest results and a setter for the input value. The query only
 * fires once the trimmed query is at least 2 characters long. Each new keystroke
 * resets a 350ms timer; the in-flight request is aborted when a new search starts.
 */
export function useSearchSuggestions(initial = "") {
  const [query, setQuery] = useState(initial);
  const [debounced, setDebounced] = useState(initial);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.length >= 2;
  const result = useQuery<MovieOrShow[]>({
    queryKey: ["search", debounced] as const,
    queryFn: ({ signal }) => searchMedia(debounced, 1, signal),
    enabled,
    staleTime: 30_000,
  });

  return {
    query,
    setQuery,
    debounced,
    results: result.data ?? [],
    isLoading: enabled && result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
  };
}