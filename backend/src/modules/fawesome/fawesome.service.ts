import axios from 'axios';

const API_BASE = 'https://fawesome.tv/home/new/v462/api/';
const PLATFORM_ID = '1217575';
const APP_ID = '9';
const SITE_ID = '236';
const AUTH_TOKEN = '1217575';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface FawesomeResult {
  title: string;
  type: string;
  poster: string;
  mp4Url: string;
  hlsUrl: string;
  genre: string;
  runtime: number;
  drm: number;
  source: 'fawesome';
}

let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL = 30 * 60 * 1000;

/**
 * Récupère (et met en cache 30 min) le security token requis en header "token"
 */
async function getSecurityToken(): Promise<string> {
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL) return cachedToken;
  const { data } = await axios.get(`${API_BASE}getSecurityToken.php`, {
    params: { appId: APP_ID, siteId: SITE_ID, 'auth-token': AUTH_TOKEN },
    timeout: 15000,
    headers: { 'User-Agent': USER_AGENT },
  });
  cachedToken = data?.securityToken || null;
  tokenFetchedAt = Date.now();
  return cachedToken || '';
}

async function recipes(params: Record<string, any>): Promise<any> {
  const token = await getSecurityToken();
  if (!token) throw new Error('Fawesome: impossible de récupérer le security token');
  const { data } = await axios.get(`${API_BASE}recipes.php`, {
    params: {
      platform_id: PLATFORM_ID,
      appId: APP_ID,
      siteId: SITE_ID,
      'auth-token': AUTH_TOKEN,
      ...params,
    },
    timeout: 20000,
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': 'https://fawesome.tv/',
      'token': token,
    },
  });
  return data;
}

function mapResult(item: any): FawesomeResult | null {
  if (!item || typeof item !== 'object') return null;
  // Ne garder que les médias avec un lien vidéo exploitable
  const mp4Url = item.video_url || item.video_flv_url || '';
  const hlsUrl = item.video_hls_url || '';
  if (!mp4Url && !hlsUrl) return null;
  return {
    title: item.title || '',
    type: item.item_type || 'movie',
    poster: item.main_picture || item.picture || item.hero_image || '',
    mp4Url,
    hlsUrl,
    genre: item.content_genre || '',
    runtime: item.runtime || 0,
    drm: item.drm ?? 0,
    source: 'fawesome',
  };
}

/**
 * Recherche un film/série sur Fawesome par titre
 */
export async function searchFawesome(query: string, type: string = 'movie'): Promise<FawesomeResult[]> {
  try {
    const data = await recipes({ searchType: 'search', keys: query });
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    const mapped = results
      .map((item): FawesomeResult | null => mapResult(item))
      .filter((r): r is FawesomeResult => r !== null)
      .filter(r => type === 'all' || r.type === type);
    console.log(`[Fawesome] Recherche "${query}" → ${mapped.length} résultats`);
    return mapped;
  } catch (error: any) {
    console.error(`[Fawesome] Erreur recherche "${query}":`, error.message);
    return [];
  }
}

/**
 * Catalogue "popular" de Fawesome (20 par page)
 */
export async function getFawesomePopular(page: number = 1): Promise<FawesomeResult[]> {
  try {
    const data = await recipes({ searchType: 'popular', page: Math.max(1, page) });
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    return results
      .map((item): FawesomeResult | null => mapResult(item))
      .filter((r): r is FawesomeResult => r !== null);
  } catch (error: any) {
    console.error(`[Fawesome] Erreur catalogue page ${page}:`, error.message);
    return [];
  }
}