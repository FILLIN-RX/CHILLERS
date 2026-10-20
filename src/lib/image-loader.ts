/**
 * image-loader.ts
 *
 * Custom Next.js image loader that serves images directly from optimized edge CDNs.
 * - TMDB images: Maps requested width dynamically to TMDB's pre-rendered WebP/JPEG sizes (w185, w342, w500, w780, w1280).
 *   Bypasses the Node.js server resize step, eliminating CPU bottlenecks, memory spikes, and 504 timeouts.
 * - Unsplash: Uses native width/quality parameters.
 * - Other CDNs: Serves directly from their origin CDN edge.
 */

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src) return "";

  // TMDB Images: Serve directly from TMDB's global CDN
  if (src.includes("image.tmdb.org")) {
    let size = "w500";
    if (width <= 185) size = "w185";
    else if (width <= 342) size = "w342";
    else if (width <= 500) size = "w500";
    else if (width <= 780) size = "w780";
    else if (width <= 1280) size = "w1280";
    else size = "w1280"; // Plafond à w1280 pour éviter de télécharger des 'original' de 10 Mo

    return src.replace(/\/t\/p\/(original|w\d+)\//, `/t/p/${size}/`);
  }

  // Unsplash: Paramètres natifs de redimensionnement
  if (src.includes("images.unsplash.com")) {
    try {
      const url = new URL(src);
      url.searchParams.set("w", String(width));
      url.searchParams.set("q", String(quality || 75));
      url.searchParams.set("auto", "format");
      return url.toString();
    } catch {
      return src;
    }
  }

  return src;
}
