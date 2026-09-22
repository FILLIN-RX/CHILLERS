/**
 * providers — small table-driven matcher for video embed hosts.
 *
 * Replaces an inline mega-regex previously hard-coded inside VideoPlayer
 * (8 hostnames, easy to forget when adding a new provider). Adding a new
 * iframe-capable host = appending one entry here.
 */

export interface ProviderMatch {
  id: string;
  test: (url: string) => boolean;
}

const DOODSTREAM_HOST_RE =
  /(?:doodstream\.com|playmogo\.com|d000d\.com|d0000d\.com|dood\.(?:to|sh|so|cx|la|wf|pm))/i;

/** Patterns known to render an iframe player instead of an HLS stream. */
export const IFRAME_PROVIDERS: ProviderMatch[] = [
  { id: "vidlink", test: (u) => u.includes("vidlink.pro") },
  { id: "youtube", test: (u) => u.includes("youtube.com") },
  { id: "doodstream", test: (u) => u.includes("doodstream.com/e/") },
  { id: "playmogo", test: (u) => u.includes("playmogo.com/e/") || u.includes("playmogo.com/d/") },
  { id: "d000d", test: (u) => u.includes("d000d.com/e/") || u.includes("d000d.com/d/") },
  { id: "d0000d", test: (u) => u.includes("d0000d.com/e/") || u.includes("d0000d.com/d/") },
  { id: "uqload", test: (u) => u.includes("uqload.is/embed") || u.includes("uqload.com/embed") },
  { id: "dood", test: (u) => /dood\.(to|sh|so|cx|la|wf|pm)\/(e|d)\//i.test(u) },
  { id: "vidapi", test: (u) => u.includes("vidapi") },
  { id: "vidzy", test: (u) => /vidzy\.(?:cc|org|xyz|co|tv|top)\/(?:embed-|d\/)[a-zA-Z0-9_-]{4,}/i.test(u) },
  { id: "streamtape", test: (u) => u.includes("streamtape.com/e/") || u.includes("streamtape.com/v/") },
];

/** Hosts that look like iframe providers but are actually direct-file proxies. */
const DIRECT_PROXY_OVERRIDES: Array<(u: string) => boolean> = [
  (u) => u.includes("/api/afroland"),
  (u) => u.includes("cdnapisec.kaltura.com"),
  (u) => u.includes("/api/doodstream/stream"),
  (u) => u.includes("/api/omnisave/proxy"),
  (u) => u.includes("/api/torrents/stream"),
  (u) => u.includes("/api/download/stream"),
  (u) => /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(u) && !u.includes("/embed"),
  (u) => u.includes("/v/") && !u.includes("/embed"),
];

/**
 * isIframeProviderUrl — true if the URL should be rendered as <iframe>
 * instead of a <video> or HLS player.
 */
export function isIframeProviderUrl(url?: string | null): boolean {
  if (!url) return false;
  if (DIRECT_PROXY_OVERRIDES.some((t) => t(url))) return false;
  return IFRAME_PROVIDERS.some((p) => p.test(url));
}

/**
 * Some providers expose a /d/ watch page but accept the file code as /e/
 * for embedding. This rewrites well-known /d/ URLs to their /e/ form so
 * the player only deals with embed URLs.
 */
export function toEmbedUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (DIRECT_PROXY_OVERRIDES.some((t) => t(url))) return url;

  const m = url.match(
    new RegExp(`${DOODSTREAM_HOST_RE.source}\\/(?:d|e)\\/([a-zA-Z0-9]+)`, "i"),
  );
  if (m) return `https://doodstream.com/e/${m[1]}`;

  const vidzy = url.match(/vidzy\.(?:cc|org|xyz|co|tv|top)\/(?:embed-|d\/)([a-zA-Z0-9_-]{4,})(?:_n)?(?:\.html)?/i);
  if (vidzy && !url.includes('/api/') && !url.includes('/v/')) return `https://vidzy.cc/embed-${vidzy[1]}.html`;

  return url;
}
