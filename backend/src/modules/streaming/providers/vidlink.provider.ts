import axios from 'axios';
import { LRUCache } from 'lru-cache';
import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';

const BASE_URL = 'https://vidlink.pro';
const PROBE_TIMEOUT = 3500;
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Seuil d'occurrences de `file_path` dans le payload de la page film.
 * Quand VidLink a un flux à servir, sa page SSR inline son catalogue lié (une
 * entrée par visuel) ; quand il ne connaît que l'identifiant TMDB, ce bloc est
 * vide — l'iframe affiche alors « We Couldn't Find This Content » et le lecteur
 * reste noir côté client.
 *
 * Étiqueté en lisant le rendu réel de vidlink.pro :
 *   indisponibles : 3000/1220813/9362617 = 0, 687180 = 1, 1592033/46643 = 3,
 *                   13645 = 4, 1180367 = 9, 25440 = 10, 587806 = 13
 *   disponibles   : 502 = 100, 1396 = 177, 9799 = 292, 680 = 353, 550 = 367,
 *                   157336 = 478, 786892 = 506, 693134 = 706, 76600 = 830
 * Le compteur reflète les données propres à VidLink, pas la richesse TMDB :
 * Aquaman 2 (587806), blockbuster bien documenté, reste à 13.
 */
const PROBE_MIN_CATALOG_ENTRIES = 25;

const availabilityCache = new LRUCache<string, boolean>({
  max: 5000,
  ttl: 6 * 60 * 60 * 1000,
});

/**
 * isContentServed — vérifie que VidLink sert réellement ce contenu.
 *
 * `supports()` accepte n'importe quel identifiant TMDB : sans ce contrôle, le
 * provider gagnait systématiquement en dernier recours et l'utilisateur voyait
 * un lecteur noir au lieu du message « Aucun flux disponible ».
 *
 * En cas de doute réseau on renvoie true (fail-open) : refuser un flux jouable
 * parce que la sonde a expiré serait pire que le comportement actuel.
 */
async function isContentServed(
  path: string,
  kind: 'movie' | 'tv'
): Promise<boolean> {
  const cached = availabilityCache.get(path);
  if (cached !== undefined) return cached;

  let served = true;
  try {
    const res = await axios.get<string>(`${BASE_URL}${path}`, {
      timeout: PROBE_TIMEOUT,
      responseType: 'text',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    });
    const body = typeof res.data === 'string' ? res.data : String(res.data);
    // Comptage validé uniquement sur les pages film : les pages épisode
    // n'inline pas ce catalogue (GoT S1E1 se joue avec 0 occurrence alors que
    // Lucky Man S1E1, absent, en a 2). Pour la TV on se limite au 5xx traité
    // dans le catch — refus franc, aucun faux négatif possible.
    if (kind === 'movie') {
      served =
        body.split('file_path').length - 1 >= PROBE_MIN_CATALOG_ENTRIES;
    }
  } catch (err: any) {
    // 500 = la page n'a pas pu être résolue côté VidLink : contenu absent.
    const status = err?.response?.status;
    if (typeof status === 'number' && status >= 500) served = false;
  }

  availabilityCache.set(path, served);
  return served;
}

/**
 * VidLink — lecteur iframe TMDB (film/épisode). Aucune URL directe exploitable :
 * c'est un fallback de dernier recours avant le P2P, le temps que les autres
 * providers aient échoué. validateUrl() le skippe (isIframeEmbedUrl).
 */
export class VidLinkProvider implements StreamingProvider {
  readonly name = 'vidlink';

  supports(query: StreamQuery): boolean {
    return Boolean(query.tmdbId && query.tmdbId > 0);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.tmdbId) return null;
    const path = `/movie/${query.tmdbId}`;
    if (!(await isContentServed(path, 'movie'))) return null;
    return {
      provider: this.name,
      embedUrl: `${BASE_URL}${path}?primaryColor=D70466&autoplay=false`,
      type: 'movie',
    };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.tmdbId) return null;
    const season = query.season || 1;
    const episode = query.episode || 1;
    const path = `/tv/${query.tmdbId}/${season}/${episode}`;
    if (!(await isContentServed(path, 'tv'))) return null;
    return {
      provider: this.name,
      embedUrl: `${BASE_URL}${path}?primaryColor=D70466&autoplay=false`,
      type: 'episode',
    };
  }
}
