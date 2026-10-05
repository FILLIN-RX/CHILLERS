"use client";

import type { SportMatch, MatchSummary } from "@/types/matches";

const CACHE_PREFIX = "chillers_match_";

export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif";

/** Date locale au format YYYY-MM-DD (évite le décalage UTC de toISOString). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

export function leagueSlugOf(match: SportMatch): string {
  return match.league.slug || match.league.id || "all";
}

export function matchHref(match: SportMatch, date: string): string {
  return `/matches/${encodeURIComponent(match.id)}?league=${encodeURIComponent(
    leagueSlugOf(match)
  )}&date=${date}`;
}

/** Reconstitue un SportMatch complet à partir des informations reçues dans le MatchSummary */
export function buildMatchFromSummary(s: MatchSummary): SportMatch {
  return {
    id: s.id,
    title: s.title,
    homeTeam: s.homeTeam,
    awayTeam: s.awayTeam,
    status: s.status,
    statusText: s.statusText,
    minute: s.minute,
    startTime: s.startTime,
    startTimestamp: new Date(s.startTime).getTime() || Date.now(),
    league: s.league,
    venue: s.venue,
    broadcast: s.broadcasts,
    sport: "football",
  };
}

/** Garde le match en session pour afficher la page détail instantanément. */
export function cacheMatch(match: SportMatch | null | undefined): void {
  if (!match?.id || match.id === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_PREFIX + match.id, JSON.stringify(match));
  } catch {}
}

export function readCachedMatch(id: string | undefined | null): SportMatch | null {
  if (!id || id === "undefined" || id === "null") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + id);
    return raw ? (JSON.parse(raw) as SportMatch) : null;
  } catch {
    return null;
  }
}
