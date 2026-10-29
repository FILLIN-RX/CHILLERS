// Sources de foot additionnelles à LiveBall : kora, kooorah, yallapro, streamiz.
// Le backend agrège les quatre sources et renvoie des matchs homogènes ; la
// résolution du player se fait ensuite à la demande, sur la page du match.
import { httpJson } from "./http";
import type { SportsMatch, SportsStream } from "@/types/sports";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function getSportsMatches(source?: string): Promise<SportsMatch[]> {
  try {
    const qs = source ? `?source=${encodeURIComponent(source)}` : "";
    const res = await httpJson<Envelope<SportsMatch[]>>(`/sports/matches${qs}`, {
      timeoutMs: 12_000,
    });
    if (res?.data) return res.data;
  } catch {
    // Silencieux : la section disparaît si le backend sports est injoignable.
  }
  return [];
}

export async function getSportsLiveMatches(): Promise<SportsMatch[]> {
  const matches = await getSportsMatches();
  return matches.filter((m) => m.status === "live");
}

export interface LiveScoreUpdate {
  source: "liveball";
  id: string;
  score: string;
  minute?: string;
}

/** Scores bruts rafraîchis à 5 s (page brute LiveBall, sans le cache 60 s). */
export async function getSportsLiveScores(): Promise<{ scores: LiveScoreUpdate[]; updatedAt: number }> {
  try {
    const res = await httpJson<Envelope<{ scores: LiveScoreUpdate[]; updatedAt: number }>>("/sports/live-scores", {
      timeoutMs: 8_000,
    });
    if (res?.data) return res.data;
  } catch {
    // Silencieux : les cartes gardent le score de l'agrégateur.
  }
  return { scores: [], updatedAt: 0 };
}

export async function getSportsStream(matchId: string): Promise<SportsStream | null> {
  try {
    const res = await httpJson<Envelope<SportsStream>>(
      `/sports/match/${encodeURIComponent(matchId)}/stream`,
      { timeoutMs: 30_000 }
    );
    if (res?.success && res.data) return res.data;
  } catch {
    // Silencieux : géré par la page (état "introuvable").
  }
  return null;
}

/**
 * Tous les serveurs/chaînes connus du match (union des providers). Le flux
 * principal arrive déjà par `/stream` — cet endpoint sert le sélecteur, et le
 * premier appel peut être lent (la chaîne complète est épuisée une fois, puis
 * le registre 24 h du backend répond instantanément).
 */
export async function getSportsChannels(matchId: string, refresh = false): Promise<SportsStream | null> {
  try {
    const res = await httpJson<Envelope<SportsStream>>(
      `/sports/match/${encodeURIComponent(matchId)}/channels${refresh ? "?refresh=true" : ""}`,
      { timeoutMs: 60_000 }
    );
    if (res?.success && res.data?.servers?.length) return res.data;
  } catch {
    // Sans multi-serveurs (flag hors prod) ou chaîne épuisée : on garde /stream.
  }
  return null;
}
