"use client";

import { useQuery } from "@tanstack/react-query";
import { getPosters } from "@/services/matches";
import { findPoster, isMajorCompetition, presentCompetition } from "@/lib/match-poster";
import type { PosterFixture } from "@/types/matches";

/**
 * Index d'affiches du service de score, partagé par les rangées et les pages de
 * match : une entrée de cache react-query pour toute la page, et un repli
 * silencieux si le service ne répond pas.
 */
export function useMatchPosterIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ["match", "posters"],
    queryFn: () => getPosters(),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const posters = data ?? [];

  return {
    posters,
    /** Faux tant que l'index n'est pas là : aucun match ne doit être masqué dessus. */
    ready: !isLoading && posters.length > 0,
  };
}

/** Ce que la carte ou le bandeau doit afficher pour une rencontre diffusée. */
export interface MatchAffiche {
  competition: string | null;
  competitionLogo?: string;
  homeLogo?: string;
  awayLogo?: string;
  major: boolean;
  /** Identifiant du service de score : sert à confondre les sources qui décrivent la même rencontre. */
  fixtureId?: string;
}

/**
 * Habille une rencontre diffusée. La présence d'une fiche dans l'index vaut
 * adhésion aux compétitions retenues : elle suffit à qualifier le match, quand
 * bien même la source ne publie aucun libellé de ligue.
 */
export function buildAffiche(
  match: {
    home: string;
    away: string;
    league?: string;
    homeLogo?: string;
    awayLogo?: string;
    startTs?: number;
  },
  posters: PosterFixture[]
): MatchAffiche {
  const found = findPoster(posters, match);
  const fixture = found?.fixture;
  const swapped = Boolean(found?.swapped);

  return {
    competition: presentCompetition(fixture?.leagueName) || presentCompetition(match.league),
    competitionLogo: fixture?.leagueLogo,
    homeLogo: (swapped ? fixture?.awayLogo : fixture?.homeLogo) || match.homeLogo,
    awayLogo: (swapped ? fixture?.homeLogo : fixture?.awayLogo) || match.awayLogo,
    major: Boolean(fixture) || isMajorCompetition(match.league),
    fixtureId: fixture?.id,
  };
}
