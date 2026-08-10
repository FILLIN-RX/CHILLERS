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
  { id: "playmogo", test: (u) => u.includes("playmogo.com") },
  { id: "d000d", test: (u) => u.includes("d000d.com") },
  { id: "d0000d", test: (u) => u.includes("d0000d.com") },
  { id: "uqload", test: (u) => u.includes("uqload.is/embed") },
  { id: "dood", test: (u) => /dood\.(to|sh|so|cx|la|wf|pm)\/e\//i.test(u) },
  { id: "vidapi", test: (u) => u.includes("vidapi") },
];

/** Hosts that look like iframe providers but are actually direct-file proxies. */
const DIRECT_PROXY_OVERRIDES: Array<(u: string) => boolean> = [
  (u) => u.includes("vidzy.cc"),
  (u) => u.includes("/api/doodstream/stream"),
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
  const m = url.match(
    new RegExp(`${DOODSTREAM_HOST_RE.source}\\/(?:d|e)\\/([a-zA-Z0-9]+)`, "i"),
  );
  return m ? `https://doodstream.com/e/${m[1]}` : url;
}
