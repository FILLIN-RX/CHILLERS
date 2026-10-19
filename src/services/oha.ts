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
 */
export async function resolveOhaStream(
  id: string,
  altIds: string[] = [],
): Promise<string> {
  const res = await httpJson<Envelope<{ url: string }>>("/live/oha/resolve", {
    query: { id, alts: altIds.length > 0 ? altIds.join(",") : undefined },
    timeoutMs: 25_000,
  });
  if (!res?.success || !res.data?.url) {
    throw new Error(res?.message || "stream unresolved");
  }
  return res.data.url;
}
