import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const RESOLVE_TIMEOUT_MS = 6_000;
const PROBE_TIMEOUT_MS = 4_000;
const MAX_SOURCES = 3;
const CACHE_TTL_MS = 2 * 60_000;

interface CachedResolution {
  url: string;
  live: boolean;
  format: string;
  expiresAt: number;
}

const resolutionCache = new Map<string, CachedResolution>();
const inFlight = new Map<string, Promise<ResolvedStream | null>>();

function cacheKey(id: string, ids: string[]): string {
  return `${id}:${ids.join(",")}`;
}


interface ResolvedStream {
  id: string;
  url: string;
  live: boolean;
  format: string;
}

/** Résout un id oha.to en URL HLS. Retourne null si échec/timeout/pas d'URL. */
async function resolveOne(id: string): Promise<ResolvedStream | null> {
  const target = `https://oha.to/live/resolve?url=${encodeURIComponent(
    `https://oha.to/live/play/${id}`,
  )}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[oha-resolve] id=${id} upstream ${res.status}`);
      return null;
    }
    const json = (await res.json().catch(() => null)) as {
      url?: string;
      live?: boolean;
      format?: string;
    } | null;
    const url = typeof json?.url === "string" && json.url.startsWith("http")
      ? json.url
      : null;
    if (!url) {
      console.warn(`[oha-resolve] id=${id} no stream url`);
      return null;
    }
    return { id, url, live: json?.live !== false, format: json?.format ?? "hls" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[oha-resolve] id=${id} error: ${message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Vérifie que la playlist répond vraiment (les tokens oha renvoient des hosts morts). */
async function probePlaylist(url: string): Promise<boolean> {
  let host = "?";
  try {
    host = new URL(url).host;
  } catch {}
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
        Referer: `${new URL(url).protocol}//${new URL(url).host}/`,
      },
      signal: ctrl.signal,
    });
    // Vérifie le début de playlist puis libère le socket. Un 200 qui renvoie
    // une page HTML (token mort, challenge CDN) ne doit pas être retenu.
    const reader = res.body?.getReader();
    if (!reader) {
      console.warn(`[oha-resolve] probe ${host} → corps absent`);
      return false;
    }
    const { value } = await reader.read();
    await reader.cancel().catch(() => {});
    const head = value ? Buffer.from(value).toString("utf8") : "";
    if (!res.ok) {
      console.warn(`[oha-resolve] probe dead ${host} → HTTP ${res.status}`);
      return false;
    }
    if (!/#EXTM3U/i.test(head)) {
      console.warn(`[oha-resolve] probe dead ${host} → pas une playlist HLS`);
      return false;
    }
    console.warn(`[oha-resolve] probe ok ${host}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[oha-resolve] probe dead ${host} → ${message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAndProbe(id: string): Promise<ResolvedStream | null> {
  const stream = await resolveOne(id);
  if (!stream) return null;
  return (await probePlaylist(stream.url)) ? stream : null;
}

/**
 * Lance les sources en parallèle et renvoie la première playlist réellement
 * vivante. Le primary part sans délai, les replis avec un léger décalage :
 * une source lente ne bloque plus les autres (l'ancien Promise.all attendait
 * la plus lente avant même de commencer les probes).
 */
function pickFirstPlayable(ids: string[]): Promise<ResolvedStream | null> {
  let settled = false;
  const pipelines = ids.map(
    (id, index) =>
      new Promise<ResolvedStream | null>((resolve) => {
        setTimeout(() => {
          if (settled) {
            resolve(null);
            return;
          }
          void resolveAndProbe(id).then(resolve).catch(() => resolve(null));
        }, index * 300);
      }),
  );
  if (pipelines.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    let pending = pipelines.length;
    for (const pipeline of pipelines) {
      pipeline
        .then((stream) => {
          if (stream) {
            settled = true;
            resolve(stream);
          } else if (--pending === 0) {
            resolve(null);
          }
        })
        .catch(() => {
          if (--pending === 0) resolve(null);
        });
    }
  });
}

function resolveShared(key: string, ids: string[]): Promise<ResolvedStream | null> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise: Promise<ResolvedStream | null> = pickFirstPlayable(ids)
    .then((chosen) => {
      if (chosen) {
        resolutionCache.set(key, {
          url: chosen.url,
          live: chosen.live,
          format: chosen.format,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
      return chosen;
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Résout un identifiant oha.to en URL HLS directe (master.m3u8).
 * Accepte `alts` (ids séparés par virgule) : les sources sont résolues en
 * parallèle, puis vérifiées (probe) — on renvoie la première playlist qui
 * répond réellement, pour éviter les 502 des tokens périmés.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^\d{1,12}$/u.test(id)) {
    return NextResponse.json(
      { success: false, message: "invalid id" },
      { status: 400 },
    );
  }
  const alts = (request.nextUrl.searchParams.get("alts") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{1,12}$/u.test(s) && s !== id)
    .slice(0, MAX_SOURCES - 1);
  const ids = [id, ...alts];
  const force = request.nextUrl.searchParams.get("force") === "1";
  const key = cacheKey(id, ids);

  const startedAt = Date.now();

  if (!force) {
    const cached = resolutionCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        {
          success: true,
          data: { url: cached.url, live: cached.live, format: cached.format },
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        },
      );
    }
  }

  const chosen = await resolveShared(key, ids);

  if (!chosen) {
    console.warn(
      `[oha-resolve] id=${id} aucune source vivante (${Date.now() - startedAt}ms)`,
    );
    return NextResponse.json(
      { success: false, message: "all sources dead" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  let host = "?";
  try {
    host = new URL(chosen.url).host;
  } catch {}
  console.warn(
    `[oha-resolve] id=${id} → ${host} (source ${chosen.id}, ${ids.length} candidat(s), ${Date.now() - startedAt}ms)`,
  );

  return NextResponse.json(
    {
      success: true,
      data: { url: chosen.url, live: chosen.live, format: chosen.format },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
