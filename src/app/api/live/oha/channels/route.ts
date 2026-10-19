import { NextResponse } from "next/server";
import {
  OHA_ALLOWLIST,
  OHA_FR_TAGS,
  ohaBaseName,
  ohaNormalizeKey,
  ohaSourceScore,
} from "@/lib/oha-channel-list";
import type { OhaChannel, OhaEpgEntry } from "@/types/oha";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CATALOG_URL = "https://oha.to/live/catalog/live/channels.json";
const LOGOS_URL = "https://iptv-org.github.io/api/logos.json";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const CATALOG_TTL_MS = 10 * 60_000;
const LOGOS_TTL_MS = 24 * 60 * 60_000;
const MAX_PAGES = 40;

interface RawEpg {
  title?: string;
  start?: string;
  end?: string;
}

interface RawItem {
  id?: string;
  name?: string;
  tags?: string[];
  ids?: { tvg?: string };
  epg?: RawEpg[];
}

interface RawLogo {
  channel?: string;
  in_use?: boolean;
  url?: string;
}

interface GlobalCache {
  channels?: { at: number; data: OhaChannel[] };
  logos?: {
    at: number;
    /** clé exacte tvg-id (ex. « TF1.fr ») */
    exact: Map<string, string>;
    /** clé normalisée sans suffixe pays (ex. « beinsports1 ») */
    norm: Map<string, string>;
  };
}

const g = globalThis as typeof globalThis & { __ohaCache?: GlobalCache };
const cache: GlobalCache = (g.__ohaCache ??= {});

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Agrège les pages du catalogue oha.to (300/page, ~35 pages), séquentiellement. */
async function fetchCatalogItems(): Promise<RawItem[]> {
  const items: RawItem[] = [];
  let cursor: string | null = "0";
  let pages = 0;

  while (cursor && pages < MAX_PAGES) {
    const url: string = `${CATALOG_URL}?cursor=${encodeURIComponent(cursor)}`;
    const res = await fetchWithTimeout(url, 15_000);
    if (!res.ok) {
      if (pages === 0) throw new Error(`catalog HTTP ${res.status}`);
      break; // on garde le déjà-fait plutôt que de tout perdre
    }
    const json = (await res.json().catch(() => null)) as {
      items?: RawItem[];
      nextCursor?: string | null;
    } | null;
    const page = json?.items;
    if (!Array.isArray(page) || page.length === 0) break;
    items.push(...page);
    cursor = json?.nextCursor || null;
    pages += 1;
    // Courte pause : limiter la pression sur le CDN d'origine.
    await new Promise((r) => setTimeout(r, 120));
  }

  if (items.length === 0) throw new Error("empty catalog");
  return items;
}

function tvgNormKey(tvg: string): string {
  return tvg
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/u, "")
    .replace(/[^a-z0-9]/gu, "");
}

/** Logos IPTV-org : exact + fallback normalisé, cache 24 h. */
async function fetchLogoMap(): Promise<{ exact: Map<string, string>; norm: Map<string, string> }> {
  const cached = cache.logos;
  if (cached && Date.now() - cached.at < LOGOS_TTL_MS) {
    return { exact: cached.exact, norm: cached.norm };
  }

  const exact = new Map<string, string>();
  const norm = new Map<string, string>();

  try {
    const res = await fetchWithTimeout(LOGOS_URL, 20_000);
    if (res.ok) {
      const logos = (await res.json().catch(() => null)) as RawLogo[] | null;
      if (Array.isArray(logos)) {
        for (const l of logos) {
          if (l?.in_use && l.channel && l.url) {
            if (!exact.has(l.channel)) {
              exact.set(l.channel, l.url);
            }
            const nk = tvgNormKey(l.channel);
            if (nk && !norm.has(nk)) {
              norm.set(nk, l.url);
            }
          }
        }
      }
    }
  } catch {
    // Pas de logo : on continue sans (le client affiche des initiales).
  }

  cache.logos = { at: Date.now(), exact, norm };
  return { exact, norm };
}

function pickEpg(item: RawItem): { now?: OhaEpgEntry; next?: OhaEpgEntry } {
  const list = Array.isArray(item.epg) ? item.epg : [];
  const entries: OhaEpgEntry[] = [];
  for (const p of list) {
    if (p?.title && p.start && p.end) {
      entries.push({ title: p.title, start: p.start, end: p.end });
    }
  }
  return { now: entries[0], next: entries[1] };
}

async function buildChannels(): Promise<OhaChannel[]> {
  const cached = cache.channels;
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.data;

  const [items, logoMaps] = await Promise.all([fetchCatalogItems(), fetchLogoMap()]);

  // Filtre France + regroupe les variantes par base normalisée.
  const groups = new Map<string, RawItem[]>();
  for (const item of items) {
    if (!item?.id || !item.name) continue;
    if (!item.tags?.some((t) => OHA_FR_TAGS.has(t))) continue;
    const key = ohaNormalizeKey(ohaBaseName(item.name));
    const arr = groups.get(key);
    if (arr) arr.push(item);
    else groups.set(key, [item]);
  }

  const channels: OhaChannel[] = [];
  const usedTvg = new Set<string>();

  for (const entry of OHA_ALLOWLIST) {
    const key = ohaNormalizeKey(ohaBaseName(entry.label));
    const variants = groups.get(key);
    if (!variants || variants.length === 0) continue;

    // Sources triées par qualité : la meilleure en primary, jusqu'à 2 replis.
    const ranked = [...variants].sort(
      (a, b) => ohaSourceScore(b.name ?? "") - ohaSourceScore(a.name ?? ""),
    );
    const best = ranked[0];

    const tvg = best.ids?.tvg;
    if (tvg) {
      if (usedTvg.has(tvg)) continue; // une seule carte par chaîne réelle
      usedTvg.add(tvg);
    }

    const { now, next } = pickEpg(best);
    const altIds = ranked
      .slice(1, 3)
      .map((v) => v.id)
      .filter((v): v is string => Boolean(v));
    const logo = tvg
      ? logoMaps.exact.get(tvg) ?? logoMaps.norm.get(tvgNormKey(tvg)) ?? null
      : null;

    channels.push({
      id: best.id!,
      altIds: altIds.length > 0 ? altIds : undefined,
      name: entry.label,
      category: entry.category,
      tvg,
      logo,
      epgNow: now,
      epgNext: next,
    });
  }

  cache.channels = { at: Date.now(), data: channels };
  return channels;
}

export async function GET() {
  try {
    const channels = await buildChannels();
    return NextResponse.json(
      { success: true, data: channels },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: `oha catalog error: ${message}` },
      { status: 502 },
    );
  }
}
