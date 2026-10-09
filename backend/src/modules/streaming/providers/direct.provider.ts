import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';
import { resolveDirectFromEmbed } from './direct-enricher';
import { isSignedLinkExpired } from '../../../utils/link-ttl';
import Movie from '../../../models/Movie';
import Serie from '../../../models/Serie';

const TAG = '[DirectProvider]';

/**
 * DirectProvider — tente d'extraire l'URL directe (.mp4 / .m3u8) d'un embed
 * Doodstream ou Uqload stocké en base, puis renvoie ce lien direct (+ referer)
 * pour que le lecteur joue le HLS/MP4 sans passer par l'iframe (qui affiche
 * des pubs).
 *
 * MongoDBProvider reste premier dans la chaîne : c'est ProviderManager qui
 * enrichit son résultat embed via `resolveDirectFromEmbed` (direct-enricher).
 * Ce provider n'intervient donc qu'en fallback (MongoDB sans lien exploitable).
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
      const scrapedU = await resolveDirectFromEmbed(uqloadEmbedUrl, { preferHls: true });
      if (scrapedU.status === 'ok') {
        console.log(`${TAG} ${label} → UQLOAD VALIDÉ en ${Date.now() - t1}ms (${scrapedU.directType})`);
        console.log(`${TAG}   directUrl: ${scrapedU.directUrl}`);
        this.updateMongoDbFreshUrl(query, scrapedU.directUrl, scrapedU.directType).catch(() => { });
        // On renvoie le lien direct (HLS/MP4) dans embedUrl ET directUrl
        // → le VideoPlayer le joue directement sans passer par l'iframe Uqload (qui affiche des pubs)
        return {
          provider: this.name,
          embedUrl: scrapedU.directUrl,
          directUrl: scrapedU.directUrl,
          directType: scrapedU.directType,
          referer: scrapedU.referer,  // ex: https://uqload.vc/embed-xxx.html — nécessaire pour le CDN Uqload
          type: query.season !== undefined ? 'episode' : 'movie',
        };
      }
      console.log(`${TAG} ${label} → API Uqload échouée, fallback embed Doodstream`);
    }

    // 2. Fallback : embed stocké (Doodstream/vidzy) scrapé en URL directe
    const embedUrl = await this.findEmbedUrl(query);
    if (!embedUrl) {
      console.log(`${TAG} ${label} → pas d'embed URL trouvée, skip`);
      return null;
    }
    console.log(`${TAG} ${label} → embed URL trouvée: ${embedUrl.slice(0, 100)}`);

    // 3-4. Extraction de l'URL directe (logique partagée : direct-enricher)
    console.log(`${TAG} ${label} → résolution directe de ${embedUrl.slice(0, 80)}...`);
    const t0 = Date.now();
    const scraped = await resolveDirectFromEmbed(embedUrl, { preferHls: true });
    const elapsed = Date.now() - t0;

    if (scraped.status !== 'ok') {
      console.log(`${TAG} ${label} → résolution directe échouée en ${elapsed}ms, fallback aux providers suivants`);
      return null;
    }

    console.log(`${TAG} ${label} → RÉSOLU en ${elapsed}ms`);
    console.log(`${TAG}   type: ${scraped.directType}`);
    console.log(`${TAG}   directUrl: ${scraped.directUrl.slice(0, 150)}`);
    console.log(`${TAG}   referer: ${scraped.referer}`);

    return {
      provider: this.name,
      embedUrl: scraped.directUrl,
      directUrl: scraped.directUrl,
      directType: scraped.directType,
      referer: scraped.referer,
      type: query.season !== undefined ? 'episode' : 'movie',
    };
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
    const st = lien.match(/streamtape\.com\/(?:e|v|f)\/([a-zA-Z0-9]+)/i);
    if (st) return `https://streamtape.com/e/${st[1]}`;
    return lien;
  }

  private isDoodOrUqload(url: string | undefined | null): boolean {
    if (!url || url === '#') return false;
    return /doodstream\.com|dood\.(to|sh|so|cx|la|wf|pm)|playmogo\.com|d000d\.com|d0000d\.com|uqload\.(is|com)/i.test(url);
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

        const lien = ep.lien;
        if (!lien || lien === '#') {
          console.log(`${TAG} MongoDB: lien vide/mort pour S${query.season}E${query.episode}`);
          return null;
        }
        if (isSignedLinkExpired(lien)) {
          console.log(`${TAG} MongoDB: lien expiré pour S${query.season}E${query.episode}: ${lien.slice(0, 80)}`);
          return null;
        }
        if (!this.isDoodOrUqload(lien)) {
          console.log(`${TAG} MongoDB: lien non-Doodstream/Uqload pour S${query.season}E${query.episode}: ${lien.slice(0, 80)}`);
          return null;
        }

        return this.toEmbedUrl(lien);
      } else {
        const movie = await this.findMovie(query);

        if (!movie) {
          console.log(`${TAG} MongoDB: film introuvable pour tmdbId=${query.tmdbId} title="${query.title}"`);
          return null;
        }

        console.log(`${TAG} MongoDB: film trouvé "${movie.titre}" (tmdbId=${movie.tmdbId})`);

        const lien = movie.lien;
        if (!lien || lien === '#') {
          console.log(`${TAG} MongoDB: lien vide/mort pour "${movie.titre}"`);
          return null;
        }
        if (isSignedLinkExpired(lien)) {
          console.log(`${TAG} MongoDB: lien expiré pour "${movie.titre}": ${lien.slice(0, 80)}`);
          return null;
        }
        if (!this.isDoodOrUqload(lien)) {
          console.log(`${TAG} MongoDB: lien non-Doodstream/Uqload pour "${movie.titre}": ${lien.slice(0, 80)}`);
          return null;
        }

        return this.toEmbedUrl(lien);
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
        if (query.season !== undefined) {
          const bySeason = byId.find(s => s.episodes?.some(
            (e: any) => Number(e.season) === Number(query.season)
          ));
          if (bySeason) return bySeason;

          const seasonRegex = new RegExp(`saison\\s*0*${query.season}\\b|s0*${query.season}\\b`, 'i');
          const byTitleSeason = byId.find(s => seasonRegex.test(s.titre));
          if (byTitleSeason) return byTitleSeason;
        }
        return byId[0];
      }
    }
    // Priority 2: title regex fallback
    if (query.title) {
      const escaped = query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const allFound = await Serie.find({ titre: { $regex: new RegExp(escaped, 'i') } }).exec();
      const byTitle = allFound.filter(s => !query.tmdbId || !s.tmdbId || Number(s.tmdbId) === Number(query.tmdbId));
      if (byTitle.length) {
        if (query.season !== undefined) {
          const bySeason = byTitle.find(s => s.episodes?.some(
            (e: any) => Number(e.season) === Number(query.season)
          ));
          if (bySeason) return bySeason;

          const seasonRegex = new RegExp(`saison\\s*0*${query.season}\\b|s0*${query.season}\\b`, 'i');
          const byTitleSeason = byTitle.find(s => seasonRegex.test(s.titre));
          if (byTitleSeason) return byTitleSeason;
        }
        console.log(`${TAG} findSerie: matched by title "${byTitle[0].titre}" (tmdbId=${byTitle[0].tmdbId}) for query tmdbId=${query.tmdbId}`);
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
    // Priority 2: title regex fallback
    if (query.title) {
      const escaped = query.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const byTitle = await Movie.findOne({ titre: { $regex: new RegExp(escaped, 'i') } }).exec();
      if (byTitle) {
        if (query.tmdbId && byTitle.tmdbId && Number(byTitle.tmdbId) !== Number(query.tmdbId)) {
          console.log(`${TAG} findMovie: rejet homonyme "${byTitle.titre}" (tmdbId en base: ${byTitle.tmdbId} !== demandé: ${query.tmdbId})`);
          return null;
        }
        console.log(`${TAG} findMovie: matched by title "${byTitle.titre}" (tmdbId=${byTitle.tmdbId}) for query tmdbId=${query.tmdbId}`);
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
