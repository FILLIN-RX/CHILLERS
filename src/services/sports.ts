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
