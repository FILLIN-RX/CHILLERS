import axios from 'axios';

/**
 * AfrolandTV (Ottera OTT + Kaltura, partner 513551).
 *
 * API ouverte avec auth_token :
 *  - `search`                        → recherche par titre (paramètre `key`)
 *  - `getreferencedobjects`          → épisodes d'une série (parent_id)
 *  - `embeddedVideoPlayer`           → config joueur → entry_id Kaltura
 *  - `video_url` / `progressive_url` → déjà présents sur les objets vidéo
 */
const API_BASE = 'https://api-ott.afrolandtv.com';
const AUTH_TOKEN = 's8B8CYQrUKMFsHFhMU';
const PARTNER_ID = '513551';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const BASE_PARAMS: Record<string, string> = {
  auth_token: AUTH_TOKEN,
  language: 'en',
  platform: 'html5',
  partner: 'html5',
};

export interface AfrolandVideo {
  id: string;
  name: string;
  videoType: string;
  showName?: string;
  season?: number;
  episode?: number;
  year?: number;
  country?: string;
  description?: string;
  posterUrl?: string;
  pageUrl?: string;
  /** HLS (playManifest applehttp) déjà construit par l'API */
  hlsUrl?: string;
  /** MP4 progressif déjà construit par l'API */
  mp4Url?: string;
}

export function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function apiGet(endpoint: string, params: Record<string, string>, timeout = 12000) {
  const { data } = await axios.get(`${API_BASE}/${endpoint}`, {
    params: { ...BASE_PARAMS, ...params },
    timeout,
    headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.afrolandtv.com/' },
  });
  return data;
}

function mapVideo(raw: any): AfrolandVideo | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  const showInfo = raw.show_info || {};
  const rawPageUrl = raw.page_url || raw.url || raw.web_url || raw.link;
  let pageUrl: string | undefined;
  if (typeof rawPageUrl === 'string') {
    try {
      const parsed = new URL(rawPageUrl, 'https://www.afrolandtv.com');
      if (parsed.hostname === 'www.afrolandtv.com' || parsed.hostname === 'afrolandtv.com') {
        pageUrl = parsed.toString();
      }
    } catch {}
  }
  const slug = String(raw.slug || raw.url_slug || raw.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const rawPoster =
    raw.img_info?.thumb_poster?.url ||
    raw.img_info?.poster?.url ||
    raw.thumb_poster_alt ||
    raw.thumbnail_url ||
    raw.screencap_widescreen ||
    raw.image_url;
  const rawDescription = raw.short_description || raw.description || raw.long_description;
  return {
    id: String(raw.id),
    name: String(raw.name || ''),
    videoType: String(raw.video_type || ''),
    showName: showInfo.show_name || undefined,
    season: showInfo.season_num ? Number(showInfo.season_num) : undefined,
    episode: showInfo.episode_num ? Number(showInfo.episode_num) : undefined,
    year: Number.parseInt(String(raw.year || raw.release_year || showInfo.year || ''), 10) || undefined,
    country: raw.country_name || raw.country || showInfo.country_name || showInfo.country || undefined,
    description: typeof rawDescription === 'string'
      ? rawDescription
      : undefined,
    posterUrl: typeof rawPoster === 'string' ? rawPoster : rawPoster?.url,
    pageUrl: pageUrl || (slug ? `https://www.afrolandtv.com/shows/${encodeURIComponent(slug)}` : undefined),
    hlsUrl: typeof raw.video_url === 'string' && raw.video_url.includes('applehttp') ? raw.video_url : undefined,
    mp4Url: typeof raw.progressive_url === 'string' && raw.progressive_url ? raw.progressive_url : undefined,
  };
}

/** Sélectionne la correspondance la plus sûre : égalité stricte, sinon préfixe. */
export function pickBestMatch<T extends { name: string }>(items: T[], query: string): T | null {
  const target = normalizeTitle(query);
  if (!target || target.length < 3) return null;

  const exact = items.find((item) => normalizeTitle(item.name) === target);
  if (exact) return exact;

  if (target.length < 4) return null;
  return (
    items.find((item) => {
      const name = normalizeTitle(item.name);
      if (!name) return false;
      return name.startsWith(target) || (target.startsWith(name) && name.length >= 4);
    }) || null
  );
}

/** Films / vidéos hors épisodes. */
export async function searchAfrolandVideos(title: string): Promise<AfrolandVideo[]> {
  try {
    const data = await apiGet('search', {
      object_type: 'video',
      video_type: 'non_episode',
      key: title,
    });
    const objects = Array.isArray(data?.objects) ? data.objects : [];
    return objects.map(mapVideo).filter((v: AfrolandVideo | null): v is AfrolandVideo => v !== null);
  } catch (error: any) {
    console.error(`[Afroland] Erreur recherche vidéo "${title}":`, error.message);
    return [];
  }
}

/** Séries (shows) — première étape pour résoudre un épisode. */
export interface AfrolandShowSearchOptions {
  startIndex?: number;
}

export interface AfrolandShowSearchPage {
  shows: AfrolandVideo[];
  totalCount?: number;
}

/** Recherche paginée de séries (une clé vide demande le catalogue complet si l'API l'autorise). */
export async function discoverAfrolandShowPage(
  title: string,
  options: AfrolandShowSearchOptions = {},
): Promise<AfrolandShowSearchPage> {
  const params: Record<string, string> = { object_type: 'show', image_format: 'poster', image_width: '500' };
  if (title) params.key = title;
  // L'API AfroLand utilise `start` (et non start_index/max_results).
  if (options.startIndex !== undefined) params.start = String(options.startIndex);
  const data = await apiGet('search', params);
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  const total = Number(data?.total_results ?? data?.total_count ?? data?.totalCount ?? data?.pager?.total_count);
  return {
    shows: objects.map(mapVideo).filter((v: AfrolandVideo | null): v is AfrolandVideo => v !== null),
    totalCount: Number.isFinite(total) && total >= 0 ? total : undefined,
  };
}

export async function discoverAfrolandShows(
  title: string,
  options: AfrolandShowSearchOptions = {},
): Promise<AfrolandVideo[]> {
  return (await discoverAfrolandShowPage(title, options)).shows;
}

/** Listing paginé des longs métrages AfroLandTV (video_type=feature). */
export async function discoverAfrolandFeaturePage(
  options: AfrolandShowSearchOptions = {},
): Promise<AfrolandShowSearchPage> {
  const params: Record<string, string> = {
    object_type: 'video',
    video_type: 'feature',
    image_format: 'poster',
    image_width: '500',
  };
  if (options.startIndex !== undefined) params.start = String(options.startIndex);
  const data = await apiGet('search', params);
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  const total = Number(data?.total_results ?? data?.total_count ?? data?.totalCount ?? data?.pager?.total_count);
  return {
    shows: objects.map(mapVideo).filter((v: AfrolandVideo | null): v is AfrolandVideo => v !== null),
    totalCount: Number.isFinite(total) && total >= 0 ? total : undefined,
  };
}

export async function searchAfrolandShows(title: string): Promise<AfrolandVideo[]> {
  try {
    return await discoverAfrolandShows(title);
  } catch (error: any) {
    console.error(`[Afroland] Erreur recherche série "${title}":`, error.message);
    return [];
  }
}

/** Épisodes d'une série, dans l'ordre de diffusion (season_num/episode_num). */
export async function getAfrolandEpisodes(showId: string): Promise<AfrolandVideo[]> {
  try {
    const data = await apiGet('getreferencedobjects', {
      parent_id: showId,
      parent_type: 'show',
      parent_meta: '1',
      r_video_type: 'episode',
      image_format: 'widescreen',
    });
    const objects = Array.isArray(data?.objects) ? data.objects : [];
    return objects.map(mapVideo).filter((v: AfrolandVideo | null): v is AfrolandVideo => v !== null);
  } catch (error: any) {
    console.error(`[Afroland] Erreur épisodes show=${showId}:`, error.message);
    return [];
  }
}

/**
 * Renvoie l'URL de lecture (HLS de préférence, sinon MP4).
 * Repli : embeddedVideoPlayer → entry_id Kaltura → playManifest applehttp.
 */
export async function resolveAfrolandStream(
  video: AfrolandVideo
): Promise<{ url: string; directType: 'hls' | 'mp4' } | null> {
  if (video.hlsUrl) return { url: video.hlsUrl, directType: 'hls' };
  if (video.mp4Url) return { url: video.mp4Url, directType: 'mp4' };

  try {
    const html = await apiGet(
      'embeddedVideoPlayer',
      { id: video.id, div_id: 'video_player', image_width: '1280' },
      10000
    );
    const text = typeof html === 'string' ? html : String(html);
    const entryMatch = text.match(/'entry_id'\s*:\s*'([^']+)'/) || text.match(/"entry_id"\s*:\s*"([^"]+)"/);
    if (!entryMatch) return null;

    const hlsUrl = `https://cdnapisec.kaltura.com/p/${PARTNER_ID}/sp/${PARTNER_ID}00/playManifest/entryId/${entryMatch[1]}/format/applehttp/protocol/https/a.m3u8`;
    return { url: hlsUrl, directType: 'hls' };
  } catch (error: any) {
    console.error(`[Afroland] Erreur résolution id=${video.id}:`, error.message);
    return null;
  }
}
