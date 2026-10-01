import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import { isSignedLinkExpired } from '../../utils/link-ttl';
import { isLanguageCompatible } from '../../utils/audio-language';
import axios from 'axios';

function toEmbedUrl(lien: string): string {
  const match = lien.match(/(?:doodstream\.com|playmogo\.com|d000d\.com|d0000d\.com|dood\.(?:to|sh|so|cx|la|wf|pm))\/(?:d|e)\/([a-zA-Z0-9]+)/i);
  if (match) return `https://doodstream.com/e/${match[1]}`;
  const stMatch = lien.match(/streamtape\.com\/(?:e|v|f)\/([a-zA-Z0-9]+)/i);
  if (stMatch) return `https://streamtape.com/e/${stMatch[1]}`;
  const vidzyMatch = lien.match(/vidzy\.(?:cc|org|xyz|co|tv|top)\/(?:embed-|d\/|v\/[^\/]+\/[^\/]+\/)([a-zA-Z0-9_-]{4,})(?:_n)?/i) || lien.match(/vidzy\.(?:cc|org|xyz|co|tv|top)\/.*\/([a-zA-Z0-9]{12,})(?:_n)?/i);
  if (vidzyMatch) return `https://vidzy.cc/embed-${vidzyMatch[1]}.html`;
  return lien;
}

/** URL du lecteur iframe Uqload à partir d'un file code. */
function uqloadEmbedUrl(code: string): string {
  return `https://uqload.is/embed-${code}.html`;
}

/** Retourne l'URL si elle est valide et non expirée, sinon tente de la convertir en embed persistant. */
function resolveUrl(url: string | undefined | null): string | null {
  if (!url || url === '#') return null;
  if (isSignedLinkExpired(url)) {
    const embed = toEmbedUrl(url);
    if (embed && embed !== url) return embed;
    return null;
  }
  return url;
}

function isEmbedOrProtectedUrl(url: string): boolean {
  return url.startsWith('/') || /doodstream|playmogo|d000d|d0000d|dood\.|vidlink|vidapi|uqload|streamtape|youtube|embed|\/e\//i.test(url);
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

async function isUqloadAlive(code: string): Promise<boolean> {
  if (!code) return false;
  try {
    const res = await axios.get(`https://uqload.is/embed-${code}.html`, {
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      validateStatus: (s) => s === 200,
    });
    const html = typeof res.data === 'string' ? res.data : '';
    if (
      html.includes('File is no longer available') ||
      html.includes('expired or has been deleted') ||
      html.includes('File Not Found') ||
      (html.includes('deleted') && html.includes('expired'))
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
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
      // Priority 2: title & originalTitle match fallback
      if (!movie) {
        const titlesToTry = [query.title, query.originalTitle].filter(Boolean) as string[];
        for (const t of titlesToTry) {
          const escaped = t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          movie = await Movie.findOne({ titre: { $regex: new RegExp(`^${escaped}$`, 'i') } }).exec();
          if (!movie && t.length > 3) {
            const fuzzyPattern = t.trim().replace(/[:\-_'"]/g, '.*');
            movie = await Movie.findOne({ titre: { $regex: new RegExp(`^${fuzzyPattern}$`, 'i') } }).exec();
          }
          if (movie) break;
        }
      }
      if (!movie) return null;

      // 0. Si le film a des sources multiples enregistrées
      if (movie.sources && movie.sources.length > 0) {
        // Filtrer par langue demandée
        const validSources = movie.sources.filter(s =>
          isLanguageCompatible(query.language, {
            titre: movie.titre,
            url: s.url,
            langueAudio: (s as any).langueAudio || movie.langueAudio,
          })
        );

        // Pour les utilisateurs Premium, prioriser les sources 1080p ou marquées isPremium
        const sortedSources = [...validSources].sort((a, b) => {
          if (query.isPremium) {
            const scoreA = (a.quality === '1080p' ? 2 : 0) + (a.isPremium ? 1 : 0);
            const scoreB = (b.quality === '1080p' ? 2 : 0) + (b.isPremium ? 1 : 0);
            return scoreB - scoreA;
          }
          return 0;
        });

        for (const s of sortedSources) {
          const u = resolveUrl(s.url);
          if (u && await isUrlAlive(u)) {
            return {
              provider: s.source || this.name,
              embedUrl: toEmbedUrl(u),
              type: 'movie'
            };
          }
        }
      }

      // 1. Priorité au lien direct (Vidzy/MP4 OpenOtaku) s'il est actif et compatible
      if (isLanguageCompatible(query.language, { titre: movie.titre, lien: movie.lien, langueAudio: movie.langueAudio })) {
        const directUrl = resolveUrl(movie.lien);
        if (directUrl && await isUrlAlive(directUrl)) {
          return { provider: movie.source || this.name, embedUrl: toEmbedUrl(directUrl), type: 'movie' };
        }
      }

      // 2. Fallback Uqload (vérification active de la disponibilité du fichier)
      if (movie.uqloadCode && isLanguageCompatible(query.language, { titre: movie.titre, lien: movie.uqloadLink, langueAudio: movie.langueAudio })) {
        const alive = await isUqloadAlive(movie.uqloadCode);
        if (alive) {
          return { provider: 'uqload', embedUrl: uqloadEmbedUrl(movie.uqloadCode), type: 'movie' };
        } else {
          console.log(`[MongoDB] Uqload code ${movie.uqloadCode} est expiré/mort pour "${movie.titre}" → suppression et passage aux autres sources`);
          Movie.updateOne({ _id: movie._id }, { $unset: { uqloadCode: 1, uqloadLink: 1 } }).exec().catch(() => {});
        }
      }

      // 3. Fallback Streamtape
      if ((movie as any).streamtapeCode && isLanguageCompatible(query.language, { titre: movie.titre, langueAudio: movie.langueAudio })) {
        return { provider: 'streamtape', embedUrl: `https://streamtape.com/e/${(movie as any).streamtapeCode}`, type: 'movie' };
      }

      // 4. Fallback lien secondaire
      const fallbackUrl = resolveUrl((movie as any).lienFallback);
      if (fallbackUrl && isLanguageCompatible(query.language, { titre: movie.titre, lien: fallbackUrl, langueAudio: movie.langueAudio }) && await isUrlAlive(fallbackUrl)) {
        return { provider: this.name, embedUrl: toEmbedUrl(fallbackUrl), type: 'movie' };
      }

      console.log(`[MongoDB] Aucun lien valide pour "${movie.titre}" (lang=${query.language || 'fr'}) → fallback providers`);
      return null;
    } catch (err) {
      console.error('[MongoDB] getMovieStream error:', err);
    }
    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (query.season === undefined || query.episode === undefined) return null;

    try {
      let serie = query.tmdbId ? await this.findSerie(query) : null;
      if (!serie) {
        const titlesToTry = [query.title, query.originalTitle].filter(Boolean) as string[];
        for (const t of titlesToTry) {
          const escaped = t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let byTitle = await Serie.find({ titre: { $regex: new RegExp(`^${escaped}$`, 'i') } }).exec();
          if (!byTitle.length && t.length > 3) {
            const fuzzyPattern = t.trim().replace(/[:\-_'"]/g, '.*');
            byTitle = await Serie.find({ titre: { $regex: new RegExp(`^${fuzzyPattern}$`, 'i') } }).exec();
          }
          if (byTitle.length) {
            const bySeason = byTitle.find(s => s.episodes?.some(
              (e: any) => Number(e.season) === Number(query.season)
            ));
            serie = bySeason || byTitle[0];
            break;
          }
        }
      }

      if (!serie) return null;

      let ep = serie.episodes?.find(
        (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode)
      );

      if (!ep) return null;

      // 0. Si l'épisode a des sources multiples enregistrées
      if (ep.sources && ep.sources.length > 0) {
        const validSources = ep.sources.filter((s: any) =>
          isLanguageCompatible(query.language, {
            titre: serie.titre,
            url: s.url,
            langueAudio: (s as any).langueAudio || ep.langueAudio || serie.langueAudio,
          })
        );

        const sortedSources = [...validSources].sort((a, b) => {
          if (query.isPremium) {
            const scoreA = (a.quality === '1080p' ? 2 : 0) + (a.isPremium ? 1 : 0);
            const scoreB = (b.quality === '1080p' ? 2 : 0) + (b.isPremium ? 1 : 0);
            return scoreB - scoreA;
          }
          return 0;
        });

        for (const s of sortedSources) {
          const u = resolveUrl(s.url);
          if (u && await isUrlAlive(u)) {
            return {
              provider: s.source || this.name,
              embedUrl: toEmbedUrl(u),
              type: 'episode'
            };
          }
        }
      }

      // 1. Priorité au lien direct (Vidzy/MP4) s'il est actif et compatible
      if (isLanguageCompatible(query.language, { titre: serie.titre, lien: ep.lien, langueAudio: ep.langueAudio || serie.langueAudio })) {
        const directUrl = resolveUrl(ep.lien);
        if (directUrl && await isUrlAlive(directUrl)) {
          return { provider: ep.source || this.name, embedUrl: toEmbedUrl(directUrl), type: 'episode' };
        }
      }

      // 2. Fallback Uqload (vérification active)
      if (ep.uqloadCode && isLanguageCompatible(query.language, { titre: serie.titre, lien: ep.uqloadLink, langueAudio: ep.langueAudio || serie.langueAudio })) {
        const alive = await isUqloadAlive(ep.uqloadCode);
        if (alive) {
          return { provider: 'uqload', embedUrl: uqloadEmbedUrl(ep.uqloadCode), type: 'episode' };
        } else {
          console.log(`[MongoDB] Uqload code ${ep.uqloadCode} est expiré/mort pour S${query.season}E${query.episode} de "${serie.titre}" → suppression`);
        }
      }

      // 3. Fallback Streamtape
      if ((ep as any).streamtapeCode && isLanguageCompatible(query.language, { titre: serie.titre, langueAudio: ep.langueAudio || serie.langueAudio })) {
        return { provider: 'streamtape', embedUrl: `https://streamtape.com/e/${(ep as any).streamtapeCode}`, type: 'episode' };
      }

      // 4. Fallback uqloadLink
      if (ep.uqloadLink && isLanguageCompatible(query.language, { titre: serie.titre, lien: ep.uqloadLink, langueAudio: ep.langueAudio || serie.langueAudio }) && await isUrlAlive(ep.uqloadLink)) {
        return { provider: 'uqload', embedUrl: toEmbedUrl(ep.uqloadLink), type: 'episode' };
      }

      console.log(`[MongoDB] Aucun lien valide pour S${query.season}E${query.episode} de "${serie.titre}" (lang=${query.language || 'fr'}) → fallback providers`);
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
          const bySeason = byId.find(s => s.episodes?.some(
            (e: any) => Number(e.season) === Number(query.season)
          ));
          if (bySeason) return bySeason;
        }
        return byId[0];
      }
    }
    return null;
  }
}

