const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface OhaResolvedStream {
  id: string;
  url: string;
}

async function resolveOne(id: string): Promise<OhaResolvedStream | null> {
  const target = `https://oha.to/live/resolve?url=${encodeURIComponent(`https://oha.to/live/play/${id}`)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(target, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { url?: unknown } | null;
    return typeof body?.url === 'string' && body.url.startsWith('https://')
      ? { id, url: body.url }
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function isLive(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        Referer: `${new URL(url).origin}/`,
      },
      signal: controller.signal,
    });
    response.body?.cancel().catch(() => undefined);
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the best currently reachable HLS URL from an OHA channel's variants. */
export async function resolveOhaChannelStream(ids: string[]): Promise<OhaResolvedStream | null> {
  const candidates = [...new Set(ids.filter((id) => /^\d{1,12}$/u.test(id)))].slice(0, 3);
  const results = await Promise.all(candidates.map(resolveOne));
  const resolved = results.filter((item): item is OhaResolvedStream => item !== null);
  const checks = await Promise.all(resolved.map(async (item) => ({ item, live: await isLive(item.url) })));
  return checks.find((check) => check.live)?.item ?? null;
}
