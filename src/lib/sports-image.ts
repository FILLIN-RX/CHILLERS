const ESPN_HOST = "a.espncdn.com";

/**
 * Return smaller CDN variants for sports marks used as tiny UI logos.
 *
 * ESPN only publishes soccer/NCAA marks at their original size (`/500/`);
 * swapping the size segment for `/100/` yields a 404. The `combiner`
 * endpoint does the actual resizing, so route those paths through it.
 */
export function getFastSportsImage(src?: string | null, displaySize = 48): string | null {
  if (!src) return null;

  const target = Math.max(32, Math.min(240, Math.round(displaySize * 2)));

  try {
    const url = new URL(src.startsWith("//") ? `https:${src}` : src);

    if (url.hostname === ESPN_HOST) {
      if (url.pathname.includes("/combiner/i")) {
        url.searchParams.set("w", String(target));
        url.searchParams.set("h", String(target));
        return url.toString();
      }

      if (/\/(?:teamlogos|leaguelogos|sportslogos)\//.test(url.pathname)) {
        return `${url.origin}/combiner/i?img=${encodeURIComponent(url.pathname)}&w=${target}&h=${target}`;
      }
    } else if (url.hostname === "upload.wikimedia.org") {
      url.pathname = url.pathname.replace(/\/\d+px-([^/]+)$/, "/128px-$1");
    }

    return url.toString();
  } catch {
    return src;
  }
}
