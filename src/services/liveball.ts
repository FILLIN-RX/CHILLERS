// LiveBall: agrégateur de matchs de foot en direct (scores + lien vers la page du match).
// Les flux eux-mêmes sont géo-restreints / gérés côté site, on renvoie donc vers
// liveball.sx/match/{id} qui joue la diffusion dans le navigateur de l'utilisateur.
import { httpJson } from "./http";
import type { LiveBallMatch, LiveBallStream } from "@/types/liveball";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function getLiveBallMatches(): Promise<LiveBallMatch[]> {
  try {
    const res = await httpJson<Envelope<LiveBallMatch[]>>("/liveball/matches", {
      timeoutMs: 8000,
    });
    if (res?.data) return res.data;
  } catch {
    // Silencieux : la section disparaît si LiveBall est injoignable.
  }
  return [];
}

// Récupère les matchs de la Champions League (scrapés depuis /league/champions-league).
export async function getLiveBallChampionsLeague(): Promise<LiveBallMatch[]> {
  try {
    const res = await httpJson<Envelope<LiveBallMatch[]>>(
      "/liveball/league/champions-league/matches",
      { timeoutMs: 12_000 }
    );
    if (res?.data) return res.data;
  } catch {
    // Silencieux.
  }
  return [];
}

// Ne renvoie que les matchs EN DIRECT dont le flux HLS a été confirmé disponible
// (le backend résout chaque flux, avec cache). Endpoint prêt en ~2-4s.
export async function getLiveBallLiveAvailable(): Promise<LiveBallMatch[]> {
  try {
    const res = await httpJson<Envelope<LiveBallMatch[]>>(
      "/liveball/matches/available",
      { timeoutMs: 25_000 }
    );
    if (res?.data) return res.data;
  } catch {
    // Silencieux.
  }
  return [];
}

// Résout l'URL HLS réelle d'un match live (via /api/liveball/match/:id/stream).
// Le backend extrayit le token signé de la page du match, le décode, puis
// interroge /api/c/r pour obtenir le flux. Retourne null si aucun flux.
export async function getLiveBallStream(matchId: string): Promise<LiveBallStream | null> {
  try {
    const res = await httpJson<Envelope<LiveBallStream>>(
      `/liveball/match/${encodeURIComponent(matchId)}/stream`,
      { timeoutMs: 45_000 }
    );
    if (res?.success && res.data) return res.data;
  } catch {
    // Silencieux : géré par la page (état "introuvable").
  }
  return null;
}