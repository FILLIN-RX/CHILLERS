import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import { isSignedLinkExpired } from '../../utils/link-ttl';
import axios from 'axios';

function toEmbedUrl(lien: string): string {
  const match = lien.match(/doodstream\.com\/(?:d|e)\/([a-zA-Z0-9]+)/);
  if (match) return `https://doodstream.com/e/${match[1]}`;
  return lien;
}

/** Retourne l'URL si elle est valide et non expirée, sinon null. */
function resolveUrl(url: string | undefined | null): string | null {
  if (!url || url === '#') return null;
  if (isSignedLinkExpired(url)) return null;
  return url;
}

/** HEAD check rapide pour savoir si l'URL est joignable (pas morte). */
async function isUrlAlive(url: string): Promise<boolean> {
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
      const movie = await Movie.findOne({
        $or: [
          ...(query.tmdbId ? [{ tmdbId: query.tmdbId }] : []),
          ...(query.title ? [{ titre: { $regex: new RegExp(query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
        ],
      }).exec();

      if (!movie) return null;

      // uqloadLink a la priorité (règle métier), fallback vers lien
      // resolveUrl() vérifie que le lien n'est pas expiré (timestamp e=)
      // isUrlAlive() vérifie que le serveur répond (HEAD)
      let url = resolveUrl(movie.uqloadLink);
      if (url && await isUrlAlive(url)) {
        return { provider: this.name, embedUrl: toEmbedUrl(url), type: 'movie' };
      }

      url = resolveUrl(movie.lien);
      if (url && await isUrlAlive(url)) {
        return { provider: this.name, embedUrl: toEmbedUrl(url), type: 'movie' };
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
      const serie = await Serie.findOne({
        $or: [
          ...(query.tmdbId ? [{ tmdbId: query.tmdbId }] : []),
          ...(query.title ? [{ titre: { $regex: new RegExp(query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }] : []),
        ],
      }).exec();

      if (!serie) return null;

      const ep = serie.episodes.find(
        (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode)
      );

      if (!ep) return null;

      // uqloadLink a la priorité, fallback vers lien
      // resolveUrl() vérifie l'expiration, isUrlAlive() vérifie la disponibilité HTTP
      let url = resolveUrl(ep.uqloadLink);
      if (url && await isUrlAlive(url)) {
        return { provider: this.name, embedUrl: toEmbedUrl(url), type: 'episode' };
      }

      url = resolveUrl(ep.lien);
      if (url && await isUrlAlive(url)) {
        return { provider: this.name, embedUrl: toEmbedUrl(url), type: 'episode' };
      }

      console.log(`[MongoDB] Aucun lien valide pour S${query.season}E${query.episode} de "${serie.titre}" → fallback`);
      return null;
    } catch (err) {
      console.error('[MongoDB] getEpisodeStream error:', err);
    }
    return null;
  }
}

