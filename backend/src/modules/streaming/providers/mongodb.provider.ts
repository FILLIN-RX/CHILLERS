import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import Movie from '../../../models/Movie';
import Serie from '../../../models/Serie';
import { isSignedLinkExpired } from '../../../utils/link-ttl';
import axios from 'axios';

function toEmbedUrl(lien: string): string {
  const match = lien.match(/(?:doodstream\.com|playmogo\.com|d000d\.com|d0000d\.com|dood\.(?:to|sh|so|cx|la|wf|pm))\/(?:d|e)\/([a-zA-Z0-9]+)/i);
  if (match) return `https://doodstream.com/e/${match[1]}`;
  const stMatch = lien.match(/streamtape\.com\/(?:e|v|f)\/([a-zA-Z0-9]+)/i);
  if (stMatch) return `https://streamtape.com/e/${stMatch[1]}`;
  return lien;
}

/** URL du lecteur iframe Uqload à partir d'un file code. */
function uqloadEmbedUrl(code: string): string {
  return `https://uqload.is/embed-${code}.html`;
}

/** Retourne l'URL si elle est valide et non expirée, sinon null. */
function resolveUrl(url: string | undefined | null): string | null {
  if (!url || url === '#') return null;
  if (isSignedLinkExpired(url)) return null;
  return url;
}

function isDirectVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|mkv|webm|m3u8)(\?|$)/i.test(url);
}

function isEmbedOrProtectedUrl(url: string): boolean {
  return /doodstream|playmogo|d000d|d0000d|dood\.|vidlink|vidapi|uqload|streamtape|youtube|embed|\/e\//i.test(url);
}

/** HEAD check rapide pour savoir si l'URL est joignable (pas morte). */
async function isUrlAlive(url: string): Promise<boolean> {
  if (isEmbedOrProtectedUrl(url)) return true;
  try {
    const res = await axios.head(url, {
      timeout: 3000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      maxRedirects: 3,
      validateStatus: (s) => s < 400,
    });
    return true;
  } catch {
    try {
      const res = await axios.get(url, {
        timeout: 3000,
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        maxRedirects: 3,
        validateStatus: (s) => s < 400,
      });
      res.data.destroy();
      return true;
    } catch {
      return false;
    }
  }
}

export class MongoDBProvider implements StreamingProvider {
  readonly name = 'mongodb';

  supports(_query: StreamQuery): boolean {
    return true;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    try {
      // Priority 1: exact tmdbId match
      let movie = query.tmdbId ? await Movie.findOne({ tmdbId: query.tmdbId }).exec() : null;
      // Priority 2: title regex fallback
      if (!movie && query.title) {
        const escaped = query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        movie = await Movie.findOne({ titre: { $regex: new RegExp(escaped, 'i') } }).exec();
      }
      if (!movie) return null;

      // Priorité au streaming Uqload via son lecteur iframe (embed-<code>.html)
      // dès qu'un fichier Uqload est prêt (uqloadCode présent).
      if (movie.uqloadCode) {
        // uqloadLink est signé (paramètre e=) : on ne le propose en download
        // que s'il n'est pas expiré, sinon on retombe sur notre endpoint.
        const dl = resolveUrl(movie.uqloadLink) || `/api/download/uqload/${movie.uqloadCode}`;
        return {
          provider: this.name,
          embedUrl: uqloadEmbedUrl(movie.uqloadCode),
          downloadUrl: dl,
          type: 'movie',
        };
      }

      // Fallback: lien stocké (embed DoodStream), converti en /e/.
      // resolveUrl() vérifie que le lien n'est pas expiré (timestamp e=)
      // isUrlAlive() vérifie que le serveur répond (HEAD)
      const url = resolveUrl(movie.lien);
      if (url && await isUrlAlive(url)) {
        return {
          provider: this.name,
          embedUrl: toEmbedUrl(url),
          downloadUrl: isDirectVideoUrl(url) ? url : undefined,
          type: 'movie',
        };
      }

      console.log(`[MongoDB] Aucun lien valide pour "${movie.titre}" (uqload + lien morts ou expirés) → fallback`);
      return null;
    } catch (err) {
      console.error('[MongoDB] getMovieStream error:', err);
    }
    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (query.season === undefined || query.episode === undefined) return null;

    try {
      // Priority 1: exact tmdbId match
      let serie = query.tmdbId ? await this.findSerie(query) : null;
      // Priority 2: title regex fallback
      if (!serie && query.title) {
        const escaped = query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const byTitle = await Serie.find({ titre: { $regex: new RegExp(escaped, 'i') } }).exec();
        if (byTitle.length) {
          const bySeason = byTitle.find(s => s.episodes?.some(
            (e: any) => Number(e.season) === Number(query.season)
          ));
          serie = bySeason || byTitle[0];
        }
      }

      if (!serie) return null;

      let ep = serie.episodes.find(
        (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode)
      );

      if (!ep || (!ep.uqloadLink && !ep.lien)) {
        console.log(`[MongoDB] S${query.season}E${query.episode} indisponible pour "${serie.titre}" → skip`);
        return null;
      }

      if (!ep) return null;

      // Priorité au lecteur iframe Uqload quand le fichier est prêt.
      if (ep.uqloadCode) {
        // Idem : lien HLS signé, valable 12h seulement.
        const dl = resolveUrl(ep.uqloadLink) || `/api/download/uqload/${ep.uqloadCode}`;
        return {
          provider: this.name,
          embedUrl: uqloadEmbedUrl(ep.uqloadCode),
          downloadUrl: dl,
          type: 'episode',
        };
      }

      // Fallback: lien stocké (embed DoodStream).
      const url = resolveUrl(ep.lien);
      if (url && await isUrlAlive(url)) {
        return {
          provider: this.name,
          embedUrl: toEmbedUrl(url),
          downloadUrl: isDirectVideoUrl(url) ? url : undefined,
          type: 'episode',
        };
      }

      console.log(`[MongoDB] Aucun lien valide pour S${query.season}E${query.episode} de "${serie.titre}" → fallback`);
      return null;
    } catch (err) {
      console.error('[MongoDB] getEpisodeStream error:', err);
    }
    return null;
  }

  private async findSerie(query: StreamQuery): Promise<any> {
    if (query.tmdbId) {
      const byId = await Serie.find({ tmdbId: query.tmdbId }).exec();
      if (byId.length) {
        if (query.season !== undefined) {
          // 1. Check if episodes match season number
          const bySeasonEp = byId.find(s => s.episodes?.some(
            (e: any) => Number(e.season) === Number(query.season)
          ));
          if (bySeasonEp) return bySeasonEp;

          // 2. Check if series title explicitly mentions the requested season (e.g. "Saison 1")
          const seasonRegex = new RegExp(`saison\\s*0*${query.season}\\b|s0*${query.season}\\b`, 'i');
          const byTitleSeason = byId.find(s => seasonRegex.test(s.titre));
          if (byTitleSeason) return byTitleSeason;
        }
        return byId[0];
      }
    }
    return null;
  }
}

