import axios from 'axios';

export const FS_BASE_URL = 'https://french-stream.net';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface FSCard {
  sourceId: string;
  title: string;
  year?: number;
  pageUrl: string;
  posterUrl?: string;
  language?: string;
  quality?: string;
  /** Série : numéro de saison extrait du titre ("Nom - Saison 3"), sinon undefined. */
  season?: number;
}

/** Catégories DLE du site (menu "Les Films" / "Les Séries"). */
export const FS_CATEGORIES = {
  films: 'films',
  series: 'series',
} as const;

export function fsPageUrl(cstart: number, category: string): string {
  return `${FS_BASE_URL}/index.php?cstart=${cstart}&do=cat&category=${category}`;
}

/** Mappe l'étiquette "version" d'une fiche FS vers notre langue normalisée. */
export function mapFsVersion(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v.includes('vostfr') && (v.includes('vf') || v.includes('french'))) return 'VF+VOSTFR';
  if (v.includes('vostfr')) return 'VOSTFR';
  if (v.includes('truefrench') || v.includes('french') || v.includes('vf')) return 'VF';
  return raw;
}

const SEASON_RE = /^(.*?)\s*[-–—]\s*[Ss]aison\s*(\d+)\s*$/;

/**
 * Extrait le titre de base + le numéro de saison d'une fiche série FS.
 * "Dumas - Saison 3" → { base: "Dumas", season: 3 }
 */
export function splitSeasonTitle(title: string): { base: string; season?: number } {
  const m = title.match(SEASON_RE);
  if (m) return { base: m[1].trim(), season: parseInt(m[2], 10) };
  return { base: title.trim() };
}

/**
 * Parse une page d'archive DLE FrenchStream et retourne les cartes listing.
 * Layout DooPlay/DLE : div.short > short-year / short-poster (newsid) / short-title / film-version.
 */
export function parseFsListingHtml(html: string): FSCard[] {
  const cards: FSCard[] = [];
  const blocks = html.split('<div class="short">').slice(1);

  for (const block of blocks) {
    const link = block.match(/class="short-poster[^"]*"[^>]*href="([^"]+)"/);
    const title = block.match(/class="short-title">([\s\S]*?)<\/div>/);
    if (!link || !title) continue;

    const href = link[1].replace(/&amp;/g, '&');
    const newsIdMatch = href.match(/newsid=(\d+)/);
    if (!newsIdMatch) continue;

    const yearMatch = block.match(/class="short-year"><a[^>]*xf=\d{4}">(\d{4})<\/a>/);
    const posterMatch = block.match(/<img src="(https:\/\/image\.tmdb\.org[^"]+)"/);
    const versionMatch = block.match(/class="film-version"><a[^>]*>([^<]+)<\/a>/);
    const qualityMatch = block.match(/class="film-quality"><a[^>]*>([^<]+)<\/a>/);

    cards.push({
      sourceId: newsIdMatch[1],
      title: decodeHtml(title[1].trim()),
      year: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
      pageUrl: href.startsWith('http') ? href : `${FS_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`,
      posterUrl: posterMatch ? posterMatch[1] : undefined,
      language: mapFsVersion(versionMatch?.[1]),
      quality: qualityMatch?.[1]?.trim() || undefined,
    });
  }

  return cards;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/** Récupère une page d'archive FS. Retourne [] si la page est vide ou en erreur. */
export async function fetchFsListingPage(cstart: number, category: string): Promise<FSCard[]> {
  const { data: html } = await axios.get(fsPageUrl(cstart, category), {
    headers: { 'User-Agent': USER_AGENT, Referer: `${FS_BASE_URL}/` },
    timeout: 20000,
    responseType: 'text',
    transformResponse: [(d) => d],
  });
  if (typeof html !== 'string' || !html.includes('class="short"')) return [];
  return parseFsListingHtml(html);
}

/** Extrait l'IMDB id (tt…) depuis le HTML d'une fiche provider, si présent. */
export function extractImdbId(html: string): string | undefined {
  const m = html.match(/imdb\.com\/title\/(tt\d{7,10})/i);
  return m ? m[1] : undefined;
}

export async function fetchFsPageHtml(pageUrl: string): Promise<string | null> {
  try {
    const { data } = await axios.get(pageUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: `${FS_BASE_URL}/` },
      timeout: 20000,
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}
