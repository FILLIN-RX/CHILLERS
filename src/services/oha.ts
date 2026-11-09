// Client API pour les chaînes FR curatées via oha.to (proxy Next local).
import { httpJson } from "./http";
import type { OhaChannel } from "@/types/oha";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Liste curatée des chaînes FR (avec logos iptv-org et programme en cours). */
export async function getOhaChannels(): Promise<OhaChannel[]> {
  const res = await httpJson<Envelope<OhaChannel[]>>("/live/oha/channels", {
    timeoutMs: 30_000,
  });
  if (!res?.success || !Array.isArray(res.data)) {
    throw new Error(res?.message || "oha channels unavailable");
  }
  return res.data;
}

/**
 * Résout l'id oha.to en URL HLS (master.m3u8).
 * `altIds` : sources alternatives de la même chaîne — le serveur les résout
 * en parallèle, vérifie les playlists (probe) et renvoie la première vivante.
 *
 * Un cache mémoire évite de relancer une résolution de 3-5 s à chaque zap.
 * Les URLs OHA restent valides plusieurs minutes ; au-delà, le player demande
 * une résolution forcée et l'ancienne entrée est remplacée.
 */
const OHA_CACHE_TTL_MS = 3 * 60_000;
const streamCache = new Map<string, { url: string; expiresAt: number }>();
const inFlight = new Map<string, Promise<string>>();

function ohaCacheKey(id: string, altIds: string[]): string {
  return `${id}:${[...altIds].filter(Boolean).sort().join(",")}`;
}

export function invalidateOhaStream(id: string, altIds: string[] = []): void {
  streamCache.delete(ohaCacheKey(id, altIds));
}

export async function resolveOhaStream(
  id: string,
  altIds: string[] = [],
  opts?: { force?: boolean },
): Promise<string> {
  const key = ohaCacheKey(id, altIds);
  if (!opts?.force) {
    const cached = streamCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise: Promise<string> = (async () => {
    const res = await httpJson<Envelope<{ url: string }>>("/live/oha/resolve", {
      query: {
        id,
        alts: altIds.length > 0 ? altIds.join(",") : undefined,
        force: opts?.force ? "1" : undefined,
      },
      timeoutMs: 25_000,
    });
    if (!res?.success || !res.data?.url) {
      throw new Error(res?.message || "stream unresolved");
    }
    streamCache.set(key, { url: res.data.url, expiresAt: Date.now() + OHA_CACHE_TTL_MS });
    return res.data.url;
  })().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}

/** Pré-résout un flux sans bloquer l'interface (survol, ouverture de page). */
export function prefetchOhaStream(id: string, altIds: string[] = []): void {
  void resolveOhaStream(id, altIds).catch(() => {});
}

export interface MatchChannelStatus {
  channel: OhaChannel;
  /** L'EPG de la chaîne annonce bien la rencontre à l'heure du match. */
  confirmed: boolean;
  matchedTitle?: string;
}

/**
 * Chaînes qui diffusent un match : le serveur croise les droits de la
 * compétition avec l'EPG (programme au coup d'envoi) et renvoie les chaînes
 * confirmées en premier.
 */
export async function getMatchChannels(
  info: {
    sport?: string;
    league?: string;
    home?: string;
    away?: string;
    /** ISO 8601 ou epoch (s/ms). */
    start?: string | number;
  },
): Promise<MatchChannelStatus[]> {
  const res = await httpJson<Envelope<MatchChannelStatus[]>>("/live/match-channels", {
    query: {
      sport: info.sport,
      league: info.league,
      home: info.home,
      away: info.away,
      start: info.start != null ? String(info.start) : undefined,
    },
    timeoutMs: 20_000,
  });
  if (!res?.success || !Array.isArray(res.data)) {
    throw new Error(res?.message || "match channels unavailable");
  }
  return res.data;
}
