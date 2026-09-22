import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import { scrapeDirectStream, isScrapableUrl } from './direct-scraper';
import { isSignedLinkExpired } from '../../utils/link-ttl';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';

const TAG = '[DirectProvider]';

/**
 * DirectProvider — tente d'extraire l'URL directe (.mp4 / .m3u8) d'un embed
 * Doodstream ou Uqload, puis construit une URL proxy qui pipe le flux via
 * notre backend (gestion des headers Referer, Range, CORS).
 *
 * Ce provider doit être placé AVANT MongoDBProvider dans la chaîne,
 * car MongoDBProvider renvoie des embed URLs (iframes) qui passent
 * toujours la validation → DirectProvider ne serait jamais appelé.
 *
 * Si le scrape échoue → fallback silencieux vers les providers suivants.
 */
export class DirectProvider implements StreamingProvider {
  readonly name = 'direct';

  supports(_query: StreamQuery): boolean {
    return true;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    return this.resolve(query);
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    return this.resolve(query);
  }

  private async resolve(query: StreamQuery): Promise<StreamResult | null> {
    const label = query.season !== undefined
      ? `S${query.season}E${query.episode} "${query.title}" (tmdb=${query.tmdbId})`
      : `"${query.title}" (tmdb=${query.tmdbId})`;
    console.log(`${TAG} resolve ${label}`);

    // 1. PRIORITÉ UQLOAD : dès qu'un file code Uqload existe, on valide le
    //    fichier via l'API uqload.is/api (joignable depuis le serveur), puis
    //    on renvoie l'iframe embed. Le CDN Uqload bloque l'IP du serveur :
    //    impossible de proxyé le flux, c'est donc le navigateur qui lit
    //    l'iframe (son IP n'est pas bloquée). Doodstream ne prend la main
    //    que si l'API échoue ou qu'aucun code Uqload n'existe.
    const uqloadCode = await this.findUqloadCode(query);
    if (uqloadCode) {
      const uqloadEmbedUrl = `https://uqload.is/embed-${uqloadCode}.html`;
      console.log(`${TAG} ${label} → Uqload prioritaire (${uqloadEmbedUrl})`);
      const t1 = Date.now();
      const scrapedU = await scrapeDirectStream(uqloadEmbedUrl, true);
      if (scrapedU) {
        console.log(`${TAG} ${label} → UQLOAD VALIDÉ en ${Date.now() - t1}ms (${scrapedU.type})`);
        console.log(`${TAG}   embedUrl: ${uqloadEmbedUrl}`);
        this.updateMongoDbFreshUrl(query, scrapedU.directUrl, scrapedU.type).catch(() => {});
        return {
          provider: this.name,
          embedUrl: uqloadEmbedUrl,
          directUrl: scrapedU.directUrl,
          directType: (scrapedU.type === 'mp4' ? 'mp4' : 'hls') as 'mp4' | 'hls',
          type: query.season !== undefined ? 'episode' : 'movie',
        };
      }
      console.log(`${TAG} ${label} → API Uqload échouée, fallback embed Doodstream`);
    }

    // 2. Fallback : embed ou flux direct stocké en MongoDB
    const streamCandidate = await this.findEmbedUrl(query);
    if (!streamCandidate) {
      console.log(`${TAG} ${label} → pas d'embed URL trouvée, skip`);
      return null;
    }
    console.log(`${TAG} ${label} → URL trouvée: ${streamCandidate.slice(0, 100)}`);

    // Cas A : L'URL est DÉJÀ un flux vidéo direct (.mp4, .m3u8, CDN Vidzy direct)
    if (this.isDirectVideo(streamCandidate)) {
      const referer = this.getReferer(streamCandidate);
      const proxyUrl = `/api/doodstream/stream?url=${encodeURIComponent(streamCandidate)}&referer=${encodeURIComponent(referer)}`;
      console.log(`${TAG} ${label} → FLUX DIRECT déjà disponible, proxyfié: ${proxyUrl.slice(0, 120)}`);
      return {
        provider: this.name,
        embedUrl: proxyUrl,
        directUrl: streamCandidate,
        directType: (/\.(m3u8)/i.test(streamCandidate) ? 'hls' : 'mp4') as 'mp4' | 'hls',
        type: query.season !== undefined ? 'episode' : 'movie',
      };
    }

    // Cas B : Vérifie que c'est un embed scrapable (Doodstream, Uqload, Vidzy)
    if (!isScrapableUrl(streamCandidate)) {
      console.log(`${TAG} ${label} → URL non scrapable, skip`);
      return null;
    }

    // Scrape pour extraire l'URL directe
    console.log(`${TAG} ${label} → lancement du scrape de ${streamCandidate.slice(0, 80)}...`);
    const t0 = Date.now();
    const scraped = await scrapeDirectStream(streamCandidate, true);
    const elapsed = Date.now() - t0;

    if (!scraped) {
      console.log(`${TAG} ${label} → scrape échoué en ${elapsed}ms, fallback aux providers suivants`);
      return null;
    }

    // Construit l'URL proxy (backend pipe le flux avec les bons headers)
    const proxyUrl = `/api/doodstream/stream?url=${encodeURIComponent(scraped.directUrl)}&referer=${encodeURIComponent(scraped.referer)}`;

    console.log(`${TAG} ${label} → SCRAPE RÉUSSI en ${elapsed}ms`);
    console.log(`${TAG}   type: ${scraped.type}`);
    console.log(`${TAG}   directUrl: ${scraped.directUrl.slice(0, 150)}`);
    console.log(`${TAG}   referer: ${scraped.referer}`);
    console.log(`${TAG}   proxyUrl: ${proxyUrl.slice(0, 150)}`);

    return {
      provider: this.name,
      embedUrl: proxyUrl,
      directUrl: scraped.directUrl,
      directType: (scraped.type === 'mp4' ? 'mp4' : 'hls') as 'mp4' | 'hls',
      type: query.season !== undefined ? 'episode' : 'movie',
    };
  }

  private isDirectVideo(url: string): boolean {
    if (!url || url === '#') return false;
    return /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(url) || /u\d+\.vidzy\.cc/i.test(url);
  }

  private getReferer(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('vidzy')) return 'https://vidzy.cc/';
      if (parsed.hostname.includes('uqload')) return 'https://uqload.is/';
      if (parsed.hostname.includes('dood') || parsed.hostname.includes('playmogo') || parsed.hostname.includes('d000')) return 'https://doodstream.com/';
      if (parsed.hostname.includes('streamtape')) return 'https://streamtape.com/';
      return `${parsed.protocol}//${parsed.host}/`;
    } catch {
      return 'https://vidzy.cc/';
    }
  }

  private async findEmbedUrl(query: StreamQuery): Promise<string | null> {
    // Source unique : MongoDB
    console.log(`${TAG} findEmbedUrl: recherche MongoDB...`);
    const mongoUrl = await this.findFromMongoDB(query);
    if (mongoUrl) {
      console.log(`${TAG} findEmbedUrl: trouvé dans MongoDB → ${mongoUrl.slice(0, 100)}`);
      return mongoUrl;
    }
    console.log(`${TAG} findEmbedUrl: pas d'embed trouvée en MongoDB`);
    return null;
  }

  private toEmbedUrl(lien: string): string {
    const m = lien.match(/(?:doodstream\.com|playmogo\.com|d000d\.com|d0000d\.com|dood\.(?:to|sh|so|cx|la|wf|pm))\/(?:d|e)\/([a-zA-Z0-9]+)/i);
    if (m) return `https://doodstream.com/e/${m[1]}`;
    const uqload = lien.match(/uqload\.(?:is|com)\/(?:embed-?([a-zA-Z0-9]+)|([a-zA-Z0-9]+))/i);
    if (uqload) return `https://uqload.is/embed-${uqload[1] || uqload[2]}.html`;
    const vidzy = lien.match(/vidzy\.(?:cc|org|xyz|co|tv|top)\/(?:embed-|d\/)([a-zA-Z0-9]+)/i);
    if (vidzy) return `https://vidzy.cc/embed-${vidzy[1]}.html`;
    const st = lien.match(/streamtape\.com\/(?:e|v|f)\/([a-zA-Z0-9]+)/i);
    if (st) return `https://streamtape.com/e/${st[1]}`;
    return lien;
  }

  private isDirectScrapable(url: string | undefined | null): boolean {
    if (!url || url === '#') return false;
    return /doodstream\.com|dood\.(to|sh|so|cx|la|wf|pm)|playmogo\.com|d000d\.com|d0000d\.com|uqload\.(is|com)|vidzy\.(cc|org|xyz|co|tv|top)|luluvid\./i.test(url);
  }

  private async findUqloadCode(query: StreamQuery): Promise<string | null> {
    try {
      if (query.season !== undefined && query.episode !== undefined) {
        const serie = await this.findSerie(query);
        if (!serie) return null;
        const ep = serie.episodes.find(
          (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode)
        );
        if (ep?.uqloadCode) return ep.uqloadCode;
        return null;
      } else {
        const movie = await this.findMovie(query);
        if (!movie) return null;
        if (movie.uqloadCode) return movie.uqloadCode;
        return null;
      }
    } catch (err) {
      console.error(`${TAG} findUqloadCode error:`, err);
    }
    return null;
  }

  private async findFromMongoDB(query: StreamQuery): Promise<string | null> {
    try {
      if (query.season !== undefined && query.episode !== undefined) {
        const serie = await this.findSerie(query);

        if (!serie) {
          console.log(`${TAG} MongoDB: série introuvable pour tmdbId=${query.tmdbId} title="${query.title}"`);
          return null;
        }

        console.log(`${TAG} MongoDB: série trouvée "${serie.titre}" (tmdbId=${serie.tmdbId})`);

        const ep = serie.episodes.find(
          (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode)
        );
        if (!ep) {
          console.log(`${TAG} MongoDB: épisode S${query.season}E${query.episode} introuvable dans "${serie.titre}" (${serie.episodes.length} épisodes)`);
          return null;
        }

        const candidates: string[] = [];
        if (ep.lien && ep.lien !== '#') candidates.push(ep.lien);
        if (ep.sources && Array.isArray(ep.sources)) {
          for (const s of ep.sources) {
            if (s?.url && s.url !== '#' && !candidates.includes(s.url)) {
              candidates.push(s.url);
            }
          }
        }

        for (const candidate of candidates) {
          if (isSignedLinkExpired(candidate)) continue;
          if (this.isDirectVideo(candidate)) {
            console.log(`${TAG} MongoDB: lien direct MP4/HLS trouvé pour S${query.season}E${query.episode}: ${candidate.slice(0, 80)}`);
            return candidate;
          }
          if (this.isDirectScrapable(candidate)) {
            console.log(`${TAG} MongoDB: lien scrapable trouvé pour S${query.season}E${query.episode}: ${candidate.slice(0, 80)}`);
            return this.toEmbedUrl(candidate);
          }
        }

        console.log(`${TAG} MongoDB: aucun lien Dood/Uqload/Vidzy scrapable pour S${query.season}E${query.episode}`);
        return null;
      } else {
        const movie = await this.findMovie(query);

        if (!movie) {
          console.log(`${TAG} MongoDB: film introuvable pour tmdbId=${query.tmdbId} title="${query.title}"`);
          return null;
        }

        console.log(`${TAG} MongoDB: film trouvé "${movie.titre}" (tmdbId=${movie.tmdbId})`);

        const candidates: string[] = [];
        if (movie.lien && movie.lien !== '#') candidates.push(movie.lien);
        if (movie.sources && Array.isArray(movie.sources)) {
          for (const s of movie.sources) {
            if (s?.url && s.url !== '#' && !candidates.includes(s.url)) {
              candidates.push(s.url);
            }
          }
        }

        for (const candidate of candidates) {
          if (isSignedLinkExpired(candidate)) continue;
          if (this.isDirectVideo(candidate)) {
            console.log(`${TAG} MongoDB: lien direct MP4/HLS trouvé pour "${movie.titre}": ${candidate.slice(0, 80)}`);
            return candidate;
          }
          if (this.isDirectScrapable(candidate)) {
            console.log(`${TAG} MongoDB: lien scrapable trouvé pour "${movie.titre}": ${candidate.slice(0, 80)}`);
            return this.toEmbedUrl(candidate);
          }
        }

        console.log(`${TAG} MongoDB: aucun lien Dood/Uqload/Vidzy scrapable pour "${movie.titre}"`);
        return null;
      }
    } catch (err) {
      console.error(`${TAG} MongoDB lookup error:`, err);
    }
    return null;
  }

  private async findSerie(query: StreamQuery): Promise<any> {
    // Priority 1: exact tmdbId match
    if (query.tmdbId) {
      const byId = await Serie.find({ tmdbId: query.tmdbId }).exec();
      if (byId.length) {
        // Si plusieurs docs partagent le même tmdbId (saisons séparées ou
        // séries homonymes), préférer celui dont les épisodes contiennent
        // la saison demandée.
        if (query.season !== undefined) {
          const bySeason = byId.find(s => s.episodes?.some(
            (e: any) => Number(e.season) === Number(query.season)
          ));
          if (bySeason) return bySeason;
        }
        return byId[0];
      }
    }
    // Priority 2: title & originalTitle match fallback (exact then fuzzy)
    const titlesToTry = [query.title, query.originalTitle].filter(Boolean) as string[];
    for (const t of titlesToTry) {
      const escaped = t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let byTitle = await Serie.find({ titre: { $regex: new RegExp(`^${escaped}$`, 'i') } }).exec();
      if (!byTitle.length && t.length > 3) {
        // Match fuzzy sans ponctuation
        const fuzzyPattern = t.trim().replace(/[:\-_'"]/g, '.*');
        byTitle = await Serie.find({ titre: { $regex: new RegExp(`^${fuzzyPattern}$`, 'i') } }).exec();
      }
      if (byTitle.length) {
        if (query.season !== undefined) {
          const bySeason = byTitle.find(s => s.episodes?.some(
            (e: any) => Number(e.season) === Number(query.season)
          ));
          if (bySeason) return bySeason;
        }
        console.log(`${TAG} findSerie: matched by title "${byTitle[0].titre}" for query "${t}"`);
        return byTitle[0];
      }
    }
    return null;
  }

  private async findMovie(query: StreamQuery): Promise<any> {
    // Priority 1: exact tmdbId match
    if (query.tmdbId) {
      const byId = await Movie.findOne({ tmdbId: query.tmdbId }).exec();
      if (byId) return byId;
    }
    // Priority 2: title & originalTitle match fallback (exact then fuzzy)
    const titlesToTry = [query.title, query.originalTitle].filter(Boolean) as string[];
    for (const t of titlesToTry) {
      const escaped = t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let byTitle = await Movie.findOne({ titre: { $regex: new RegExp(`^${escaped}$`, 'i') } }).exec();
      if (!byTitle && t.length > 3) {
        const fuzzyPattern = t.trim().replace(/[:\-_'"]/g, '.*');
        byTitle = await Movie.findOne({ titre: { $regex: new RegExp(`^${fuzzyPattern}$`, 'i') } }).exec();
      }
      if (byTitle) {
        console.log(`${TAG} findMovie: matched title "${byTitle.titre}" (tmdbId=${byTitle.tmdbId}) for query "${t}"`);
        return byTitle;
      }
    }
    return null;
  }

  private async updateMongoDbFreshUrl(query: StreamQuery, freshUrl: string, type?: string): Promise<void> {
    try {
      // Seuls les liens MP4 directs sont stockés dans uqloadLink : un lien
      // HLS (.m3u8) signé est éphémère et casserait le téléchargement qui
      // attend un fichier .mp4.
      if (type !== undefined && type !== 'mp4') {
        console.log(`${TAG} type=${type}, pas de mise à jour de uqloadLink (mp4 uniquement)`);
        return;
      }
      if (query.season !== undefined && query.episode !== undefined) {
        const serie = await this.findSerie(query);
        if (serie) {
          const ep = serie.episodes.find(
            (e: any) => Number(e.season) === Number(query.season) && Number(e.episodeNumber) === Number(query.episode)
          );
          if (ep?.uqloadCode) {
            await Serie.updateOne(
              { _id: serie._id, 'episodes.uqloadCode': ep.uqloadCode },
              { $set: { 'episodes.$.uqloadLink': freshUrl } }
            );
            console.log(`${TAG} MongoDB updated uqloadLink for episode "${query.title}" S${query.season}E${query.episode}`);
          }
        }
      } else {
        const movie = await this.findMovie(query);
        if (movie?.uqloadCode) {
          await Movie.updateOne(
            { _id: movie._id },
            { $set: { uqloadLink: freshUrl } }
          );
          console.log(`${TAG} MongoDB updated uqloadLink for "${query.title}"`);
        }
      }
    } catch (err: any) {
      console.error(`${TAG} MongoDB update error:`, err.message);
    }
  }
}
