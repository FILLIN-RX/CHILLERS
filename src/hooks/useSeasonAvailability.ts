"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAvailableSeasons } from "@/services/media";
import type { SeasonAvailabilityInfo } from "@/types/media";

const STORAGE_PREFIX = "chillers:unavailable-seasons:";

function readBlocked(id: string): number[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function writeBlocked(id: string, seasons: number[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(seasons));
  } catch {
    // Stockage indisponible (mode privé) : le blocage reste valable en mémoire.
  }
}

/**
 * Disponibilité des saisons.
 *
 * - On ne bloque que les saisons FUTURES sans source.
 * - Une saison sortie ou en cours de diffusion reste accessible (les providers
 *   peuvent la servir même si elle n'est pas encore indexée localement).
 * - Un échec de résolution local ne bloque pas une saison sortie/en cours.
 */
export function useSeasonAvailability(id: string | undefined) {
  const [seasonInfos, setSeasonInfos] = useState<SeasonAvailabilityInfo[]>([]);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAvailableSeasons(id)
      .then((list) => {
        if (!cancelled) setSeasonInfos(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const infoMap = useMemo(() => {
    const m = new Map<number, SeasonAvailabilityInfo>();
    for (const info of seasonInfos) m.set(info.season, info);
    return m;
  }, [seasonInfos]);

  const getSeasonInfo = useCallback(
    (season: number): SeasonAvailabilityInfo | undefined => infoMap.get(season),
    [infoMap],
  );

  const markUnavailable = useCallback(
    (season: number) => {
      if (!id) return;
      const info = infoMap.get(season);
      // Ne pas mémoriser un blocage pour une saison déjà sortie/en cours :
      // les providers doivent rester tentables.
      if (info && (info.released || info.airing)) return;
      const current = readBlocked(id);
      if (current.includes(season)) return;
      writeBlocked(id, [...current, season]);
      setRevision((value) => value + 1);
    },
    [id, infoMap],
  );

  const isUnavailable = useCallback(
    (season: number): boolean => {
      const info = infoMap.get(season);
      if (info) {
        // Bloqué uniquement si pas encore sortie et sans source connue.
        return info.future && !info.hasSources;
      }
      // Pas d'info serveur pour cette saison : ne pas bloquer.
      // (les anciens blocages locaux ne s'appliquent qu'en l'absence totale d'info)
      if (seasonInfos.length === 0) {
        const blocked = id ? readBlocked(id) : [];
        return blocked.includes(season);
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, infoMap, seasonInfos.length, revision],
  );

  const isAiring = useCallback(
    (season: number): boolean => infoMap.get(season)?.airing === true,
    [infoMap],
  );

  // Compat: liste des numéros de saisons avec source (anciens consommateurs).
  const availableSeasons = useMemo(
    () => seasonInfos.filter((s) => s.hasSources).map((s) => s.season),
    [seasonInfos],
  );

  return { isUnavailable, markUnavailable, availableSeasons, seasonInfos, getSeasonInfo, isAiring };
}
