import { httpJson } from "./http";
import type { SportMatch, MatchLeague, MatchesFilterOptions } from "@/types/matches";

interface Envelope<T> {
  success: boolean;
  data?: T;
  count?: number;
  message?: string | null;
}

export async function getMatches(options: MatchesFilterOptions = {}): Promise<SportMatch[]> {
  try {
    const params = new URLSearchParams();
    if (options.status && options.status !== "all") params.set("status", options.status);
    if (options.league) params.set("league", options.league);
    if (options.date) params.set("date", options.date);
    if (options.sport && options.sport !== "all") params.set("sport", options.sport);
    if (options.search) params.set("search", options.search);

    const queryString = params.toString();
    const endpoint = `/matches${queryString ? `?${queryString}` : ""}`;

    const res = await httpJson<Envelope<SportMatch[]>>(endpoint, {
      timeoutMs: 20_000,
    });

    if (res?.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch (error) {
    console.warn("[MatchesService] Erreur récupération des matchs:", error);
  }
  return [];
}

export async function getLeagues(): Promise<MatchLeague[]> {
  try {
    const res = await httpJson<Envelope<MatchLeague[]>>("/matches/leagues", {
      timeoutMs: 8_000,
    });
    if (res?.data && Array.isArray(res.data)) {
      return res.data;
    }
  } catch (error) {
    console.warn("[MatchesService] Erreur récupération des ligues:", error);
  }
  return [];
}

export async function getMatchById(id: string): Promise<SportMatch | null> {
  if (!id || id === "undefined" || id === "null") return null;
  try {
    const res = await httpJson<Envelope<SportMatch>>(`/matches/${encodeURIComponent(id)}`, {
      timeoutMs: 10_000,
    });
    if (res?.data) {
      return res.data;
    }
  } catch (error) {
    console.warn(`[MatchesService] Erreur récupération du match ${id}:`, error);
  }
  return null;
}

export async function getMatchSummary(id: string, league?: string): Promise<import("@/types/matches").MatchSummary | null> {
  if (!id || id === "undefined" || id === "null") return null;
  try {
    const params = new URLSearchParams();
    if (league && league !== "all") params.set("league", league);

    const queryString = params.toString();
    const endpoint = `/matches/${encodeURIComponent(id)}/summary${queryString ? `?${queryString}` : ""}`;

    const res = await httpJson<Envelope<import("@/types/matches").MatchSummary>>(endpoint, {
      timeoutMs: 12_000,
    });
    if (res?.data) {
      return res.data;
    }
  } catch (error) {
    console.warn(`[MatchesService] Erreur récupération summary du match ${id}:`, error);
  }
  return null;
}

export async function getMatchStream(id: string): Promise<any | null> {
  if (!id || id === "undefined" || id === "null") return null;
  try {
    const res = await httpJson<Envelope<any>>(`/matches/${encodeURIComponent(id)}/stream`, {
      timeoutMs: 15_000,
    });
    if (res?.data) {
      return res.data;
    }
  } catch (error) {
    console.warn(`[MatchesService] Erreur récupération flux direct du match ${id}:`, error);
  }
  return null;
}

