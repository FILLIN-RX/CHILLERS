import axios from 'axios';

const API_BASE = 'https://ga-prod-api.powr.tv';
const SITE = 'fmplus';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface FmplusResult {
  uid: string;
  title: string;
  description: string;
  type: string;
  poster: string;
  backdrop: string;
  duration: number;
  channels: string[];
  freeToWatch: boolean;
  source: 'freemoviesplus';
}

export interface FmplusStreams {
  dash: string;
  hls: string;
  mp4: string;
  hds: string;
}

function mapResult(item: any): FmplusResult | null {
  if (!item || typeof item !== 'object') return null;
  const thumb = item.metadata?.thumbnails?.maxres || item.metadata?.thumbnails?.medium || '';
  const bd = item.metadata?.providerThumbnails?.maxres || item.metadata?.providerThumbnails?.medium || '';
  return {
    uid: item.uid || '',
    title: item.title || '',
    description: item.description || '',
    type: item.type || 'movie',
    poster: thumb,
    backdrop: bd,
    duration: item.contentDetails?.duration || 0,
    channels: Array.isArray(item.channels) ? item.channels : [],
    freeToWatch: item.freeToWatch ?? false,
    source: 'freemoviesplus',
  };
}

/**
 * Recherche un film/série sur Free Movies Plus (catalogue Unreel/POWR)
 */
export async function searchFmplus(query: string, type: string = 'movie'): Promise<FmplusResult[]> {
  try {
    const { data } = await axios.get(`${API_BASE}/v2/sites/${SITE}/videos-search`, {
      params: { q: query, type, page: 1, limit: 100 },
      timeout: 20000,
      headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://www.freemoviesplus.com/' },
    });
    const items = Array.isArray(data) ? data : [];
    const mapped = items.map(mapResult).filter((r): r is FmplusResult => r !== null);
    console.log(`[FreeMoviesPlus] Recherche "${query}" → ${mapped.length} résultats`);
    return mapped;
  } catch (error: any) {
    console.error(`[FreeMoviesPlus] Erreur recherche "${query}":`, error.message);
    return [];
  }
}

/**
 * Détail d'un média : récupère les streams (peut être vide si la résolution
 * nécessite l'étape d'autorisation du player Ooyala)
 */
export async function getFmplusVideo(uid: string): Promise<{ result: FmplusResult | null; streams: FmplusStreams }> {
  try {
    const { data } = await axios.get(`${API_BASE}/v2/sites/${SITE}/videos/${encodeURIComponent(uid)}`, {
      timeout: 20000,
      headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://www.freemoviesplus.com/' },
    });
    return {
      result: mapResult(data),
      streams: {
        dash: data?.streams?.dash || '',
        hls: data?.streams?.hls || '',
        mp4: data?.streams?.mp4 || '',
        hds: data?.streams?.hds || '',
      },
    };
  } catch (error: any) {
    console.error(`[FreeMoviesPlus] Erreur détail "${uid}":`, error.message);
    return { result: null, streams: { dash: '', hls: '', mp4: '', hds: '' } };
  }
}