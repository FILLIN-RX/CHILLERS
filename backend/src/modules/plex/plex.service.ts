import axios from 'axios';

const PAGE_URL = 'https://watch.plex.tv/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface PlexResult {
  title: string;
  type: 'movie' | 'show';
  slug: string;
  watchId: string;
  watchUrl: string;
  poster: string;
  source: 'plex';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .trim();
}

/**
 * Extrait les médias (films/séries) depuis le HTML pré-rendu de la page
 * d'accueil de watch.plex.tv. Chaque carte a un lien <a data-id=...> suivi
 * du <img> poster.
 */
export async function getPlexCatalog(): Promise<PlexResult[]> {
  try {
    const { data: html } = await axios.get(PAGE_URL, {
      timeout: 20000,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
      maxContentLength: 10 * 1024 * 1024,
    });

    const items: PlexResult[] = [];
    const seen = new Set<string>();

    const tileRegex = /<a data-id="tv\.plex\.provider\.discover-([a-f0-9]+)"[^>]*aria-label="([^"]+)"[^>]*href="(\/movie\/[^"]+|\/show\/[^"]+)"[^>]*><\/a>[\s\S]{0,3000}?<img[^>]*src="([^"]+)"[^>]*\/>/g;
    let match: RegExpExecArray | null;

    while ((match = tileRegex.exec(html)) !== null) {
      const watchId = match[1];
      const rawTitle = match[2];
      const slug = match[3];
      const rawPoster = match[4];

      if (seen.has(watchId)) continue;
      seen.add(watchId);

      const title = decodeHtmlEntities(rawTitle);
      if (!title) continue;

      items.push({
        title,
        type: slug.startsWith('/show') ? 'show' : 'movie',
        slug,
        watchId,
        watchUrl: `https://watch.plex.tv/watch/video?uri=provider%3A%2F%2Ftv.plex.provider.discover%2Flibrary%2Fmetadata%2F${watchId}`,
        poster: decodeHtmlEntities(rawPoster),
        source: 'plex',
      });
    }

    console.log(`[Plex] Catalogue extrait : ${items.length} médias`);
    return items;
  } catch (error: any) {
    console.error(`[Plex] Erreur récupération catalogue:`, error.message);
    return [];
  }
}