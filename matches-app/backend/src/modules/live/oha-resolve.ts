const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const RESOLVE_TIMEOUT_MS = 6_000;
const PROBE_TIMEOUT_MS = 4_000;
const MAX_SOURCES = 3;

export interface ResolvedStream {
  id: string;
  url: string;
  live: boolean;
  format: string;
}

async function resolveOne(id: string): Promise<ResolvedStream | null> {
  const target = `https://oha.to/live/resolve?url=${encodeURIComponent(
    `https://oha.to/live/play/${id}`,
  )}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      url?: string;
      live?: boolean;
      format?: string;
    } | null;
    const url = typeof json?.url === 'string' && json.url.startsWith('http') ? json.url : null;
    if (!url) return null;
    return { id, url, live: json?.live !== false, format: json?.format ?? 'hls' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function probePlaylist(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const parsed = new URL(url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Referer: `${parsed.protocol}//${parsed.host}/`,
      },
      signal: ctrl.signal,
    });
    res.body?.cancel().catch(() => {});
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Résout le meilleur HLS joignable parmi l'id principal et ses alternatives. */
export async function resolveOhaStream(id: string, alts: string[]): Promise<ResolvedStream | null> {
  const ids = [id, ...alts.filter((alt) => alt !== id)].slice(0, MAX_SOURCES);
  const results = await Promise.allSettled(ids.map(resolveOne));
  const streams = results
    .filter((r): r is PromiseFulfilledResult<ResolvedStream | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((s): s is ResolvedStream => s !== null);

  if (streams.length === 0) return null;

  const probes = await Promise.all(
    streams.map(async (stream) => ({ stream, ok: await probePlaylist(stream.url) })),
  );
  return probes.find((probe) => probe.ok)?.stream ?? null;
}
