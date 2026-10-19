"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getPersonDetails } from "@/services/media";
import type { PersonDetails } from "@/types/media";

/**
 * usePersonDetails — fetch a TMDB person (actor / director) by id,
 * including their combined credits (movies + series) in a single call.
 */
export function usePersonDetails(
  id: string | undefined,
  options?: Omit<UseQueryOptions<PersonDetails | null>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["person-details", id] as const,
    queryFn: ({ signal }) => getPersonDetails(id as string, signal),
    enabled: !!id,
    staleTime: 5 * 60_000,
    ...options,
  });
}
