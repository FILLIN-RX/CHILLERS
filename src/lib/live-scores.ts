import type { LiveScoreUpdate } from "@/services/sports";
import type { SportsMatch } from "@/types/sports";

/**
 * Remplace le score des cartes LiveBall par le relevé 5 s. Les autres sources
 * (kora, kooorah…) n'ont pas de score en direct et gardent leur valeur.
 */
export function applyLiveScores(
  matches: SportsMatch[],
  scores: Map<string, LiveScoreUpdate>,
): SportsMatch[] {
  return matches.map((match) => {
    if (match.source !== "liveball") return match;
    const update = scores.get(`liveball:${match.sourceId ?? match.id}`);
    if (!update) return match;
    return { ...match, score: update.score, minute: update.minute ?? match.minute };
  });
}
