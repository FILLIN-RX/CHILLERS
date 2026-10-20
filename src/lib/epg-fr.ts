import { gunzipSync } from "node:zlib";
import type { OhaChannel } from "@/types/oha";

/**
 * EPG France complète (XMLTV) pour confirmer la diffusion d'un match.
 * Source : EPGShare01 (mise à jour quotidienne), ~5 Mo gzip / ~40 Mo XML.
 * Index en mémoire par nom de chaîne normalisé, rafraîchi toutes les 3 h.
 */

export interface EpgProgram {
  title: string;
  /** epoch ms */
  start: number;
  /** epoch ms */
  end: number;
}

const EPG_URL = "https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz";
const TTL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 45_000;

export type EpgIndex = Map<string, EpgProgram[]>;

declare global {
  var __epgFrCacheV1: { at: number; index: EpgIndex } | undefined;
  var __epgFrPendingV1: Promise<{ at: number; index: EpgIndex } | null> | undefined;
}

/** Clé de correspondance : minuscules, sans accents, alphanumérique uniquement. */
export function epgKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]/gu, "");
}

function parseXmlTime(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/u.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, tz] = m;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (!tz) return utc;
  const sign = tz.startsWith("-") ? -1 : 1;
  const offsetMin = sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5)));
  return utc - offsetMin * 60_000;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;|&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#(\d+);/gu, (_, n: string) => String.fromCodePoint(Number(n)));
}

export function parseXmltv(xml: string): EpgIndex {
  const displayById = new Map<string, string>();
  const channelRe = /<channel\s+id="([^"]+)"\s*>([\s\S]*?)<\/channel>/gu;
  for (const m of xml.matchAll(channelRe)) {
    const name = /<display-name[^>]*>([^<]*)<\/display-name>/u.exec(m[2]);
    if (name) displayById.set(m[1], decodeEntities(name[1]).trim());
  }

  const byId = new Map<string, EpgProgram[]>();
  const programRe = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gu;
  for (const m of xml.matchAll(programRe)) {
    const attrs = m[1];
    const channel = /\bchannel="([^"]+)"/u.exec(attrs)?.[1];
    const startRaw = /\bstart="([^"]+)"/u.exec(attrs)?.[1];
    const stopRaw = /\bstop="([^"]+)"/u.exec(attrs)?.[1];
    if (!channel || !startRaw || !stopRaw) continue;
    const title = /<title[^>]*>([^<]*)<\/title>/u.exec(m[2])?.[1];
    if (!title) continue;
    const start = parseXmlTime(startRaw);
    const end = parseXmlTime(stopRaw);
    if (start == null || end == null || end <= start) continue;

    let list = byId.get(channel);
    if (!list) {
      list = [];
      byId.set(channel, list);
    }
    list.push({ title: decodeEntities(title).trim(), start, end });
  }

  const index: EpgIndex = new Map();
  for (const [id, list] of byId) {
    list.sort((a, b) => a.start - b.start);
    const keys = new Set([epgKey(id), epgKey(displayById.get(id) ?? "")]);
    for (const key of keys) {
      if (key) index.set(key, list);
    }
  }
  return index;
}

async function loadIndex(): Promise<{ at: number; index: EpgIndex } | null> {
  try {
    const res = await fetch(EPG_URL, {
      cache: "no-store",
      headers: { "user-agent": "CHILLERS/1.0 (+epg-match-check)" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const gz = Buffer.from(await res.arrayBuffer());
    const xml = gunzipSync(gz).toString("utf8");
    return { at: Date.now(), index: parseXmltv(xml) };
  } catch (err) {
    console.warn("[epg-fr] chargement impossible:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Index EPG partagé (cache 3 h, une seule requête concurrente). */
export async function getEpgIndex(): Promise<EpgIndex | null> {
  const cached = globalThis.__epgFrCacheV1;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.index;

  if (!globalThis.__epgFrPendingV1) {
    globalThis.__epgFrPendingV1 = loadIndex().then((result) => {
      if (result) globalThis.__epgFrCacheV1 = result;
      return result;
    });
  }

  try {
    const result = await globalThis.__epgFrPendingV1;
    return result?.index ?? null;
  } finally {
    globalThis.__epgFrPendingV1 = undefined;
  }
}

/** Programmes d'une chaîne autour du coup d'envoi (2 h avant → 3 h après). */
export function programsAround(
  index: EpgIndex,
  channel: Pick<OhaChannel, "name" | "tvg">,
  startMs: number,
): EpgProgram[] {
  const keys = [epgKey(channel.name), channel.tvg ? epgKey(channel.tvg) : ""].filter(Boolean);
  for (const key of keys) {
    const list = index.get(key);
    if (!list?.length) continue;
    // Le programme qui est à l'antenne au coup d'envoi (pas les émissions voisines).
    return list.filter((p) => p.start <= startMs && p.end > startMs);
  }
  return [];
}
