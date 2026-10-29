"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSportsLiveScores, type LiveScoreUpdate } from "@/services/sports";

const LIVE_SCORE_INTERVAL_MS = 5_000;

/**
 * Scores de football rafraîchis toutes les 5 s, indexés par `source:id`
 * (ex. `liveball:1645430`). Une seule requête partagée pour tous les composants.
 * `enabled` évite de sonder une page sans match en direct.
 */
export function useLiveScores(enabled = true): Map<string, LiveScoreUpdate> {
  const { data } = useQuery({
    queryKey: ["live", "scores"],
    queryFn: getSportsLiveScores,
    enabled,
    staleTime: 4_000,
    refetchInterval: LIVE_SCORE_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  return useMemo(() => {
    const scores = new Map<string, LiveScoreUpdate>();
    for (const entry of data?.scores ?? []) scores.set(`${entry.source}:${entry.id}`, entry);
    return scores;
  }, [data]);
}
