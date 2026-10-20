/** Return smaller CDN variants for sports marks used as tiny UI logos. */
export function getFastSportsImage(src?: string | null): string | null {
  if (!src) return null;

  try {
    const url = new URL(src.startsWith("//") ? `https:${src}` : src);

    if (url.hostname === "a.espncdn.com") {
      if (url.pathname.includes("/combiner/i")) {
        url.searchParams.set("w", "96");
        url.searchParams.set("h", "96");
      } else if (/\/(?:500|200|100)\/[^/]+$/.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/(?:500|200|100)\//, "/100/");
      }
    } else if (url.hostname === "upload.wikimedia.org") {
      url.pathname = url.pathname.replace(/\/\d+px-([^/]+)$/, "/128px-$1");
    }

    return url.toString();
  } catch {
    return src;
  }
}
