import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const RESOLVE_TIMEOUT_MS = 6_000;
const PROBE_TIMEOUT_MS = 4_000;
const MAX_SOURCES = 3;

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
    // Libère le socket : on ne veut que le statut, pas le corps.
    res.body?.cancel().catch(() => {});
    if (!res.ok) {
      console.warn(`[oha-resolve] probe dead ${host} → HTTP ${res.status}`);
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

/**
 * Résout un identifiant oha.to en URL HLS directe (master.m3u8).
 * Accepte `alts` (ids séparés par virgule) : les sources sont résolues en
 * parallèle, puis vérifiées (probe) dans l'ordre — on renvoie la première
 * playlist qui répond réellement, pour éviter les 502 des tokens périmés.
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

  const startedAt = Date.now();

  // 1. Résolution parallèle de toutes les sources candidates.
  const results = await Promise.allSettled(ids.map(resolveOne));
  const streams = results
    .filter(
      (r): r is PromiseFulfilledResult<ResolvedStream | null> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((s): s is ResolvedStream => s !== null);

  if (streams.length === 0) {
    console.warn(
      `[oha-resolve] id=${id} aucune source résolue (${Date.now() - startedAt}ms)`,
    );
    return NextResponse.json(
      { success: false, message: "no stream url" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  // 2. Probe en parallèle de toutes les candidatures ; on garde la première
  //    vivante dans l'ordre de priorité (primary d'abord).
  const probes = await Promise.all(
    streams.map(async (s) => ({ stream: s, ok: await probePlaylist(s.url) })),
  );
  const chosen = probes.find((p) => p.ok)?.stream ?? null;

  // 3. Toutes les sources sont mortes : on échoue vite plutôt que de renvoyer
  //    une URL qui ferait bufferiser le lecteur pendant 8 s avant un 502.
  if (!chosen) {
    console.warn(
      `[oha-resolve] id=${id} toutes les sources mortes (${streams.length} testée(s), ${Date.now() - startedAt}ms)`,
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
    `[oha-resolve] id=${id} → ${host} (source ${chosen.id}, ${streams.length} candidat(s), ${Date.now() - startedAt}ms)`,
  );

  return NextResponse.json(
    {
      success: true,
      data: { url: chosen.url, live: chosen.live, format: chosen.format },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
