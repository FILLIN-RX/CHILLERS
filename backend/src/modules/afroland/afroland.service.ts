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
  return {
    id: String(raw.id),
    name: String(raw.name || ''),
    videoType: String(raw.video_type || ''),
    showName: showInfo.show_name || undefined,
    season: showInfo.season_num ? Number(showInfo.season_num) : undefined,
    episode: showInfo.episode_num ? Number(showInfo.episode_num) : undefined,
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
export async function searchAfrolandShows(title: string): Promise<AfrolandVideo[]> {
  try {
    const data = await apiGet('search', { object_type: 'show', key: title });
    const objects = Array.isArray(data?.objects) ? data.objects : [];
    return objects.map(mapVideo).filter((v: AfrolandVideo | null): v is AfrolandVideo => v !== null);
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
