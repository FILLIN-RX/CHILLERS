import axios from 'axios';
import { FSCard, mapFsVersion } from './frenchstream-listing';

export const W16_BASE_URL = 'https://w16.french-manga.net';
export const W16_ANIME_PATH = '/index.php?do=xfsearch&xfname=Type&xf=Anime';
export const W16_ANIME_FILMS_PATH = '/xfsearch/serie-statut/Film/';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

function decodeHtml(value: string): string {
  return value
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

function textContent(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  return text || undefined;
}

/** Les titres affichés dans les cartes peuvent être tronqués; l'attribut alt garde le titre complet. */
export function parseW16AnimeListing(html: string): FSCard[] {
  const cards: FSCard[] = [];
  for (const block of html.split('<div class="short">').slice(1)) {
    const anchor = block.match(/<a\b(?=[^>]*class=["'][^"']*short-poster)[^>]*>/i)?.[0];
    const hrefMatch = anchor?.match(/\bhref=["']([^"']+)["']/i);
    const id = hrefMatch?.[1].match(/[?&]newsid=(\d+)/i)?.[1];
    if (!hrefMatch || !id) continue;

    const sourceTitle = anchor?.match(/\balt=["']([^"']+)["']/i)?.[1];
    const visibleTitle = block.match(/class=["']short-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const title = textContent(sourceTitle) || textContent(visibleTitle);
    if (!title) continue;

    const poster = block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
    const yearText = block.match(/class=["']short-year[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
    const year = yearText?.match(/\b((?:19|20)\d{2})\b/)?.[1];
    const version = block.match(/class=["']film-version[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)?.[1];
    const quality = block.match(/class=["']film-quality[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)?.[1];
    const absoluteUrl = new URL(decodeHtml(hrefMatch[1]), W16_BASE_URL).toString();

    cards.push({
      sourceId: id,
      title,
      year: year ? Number(year) : undefined,
      pageUrl: absoluteUrl,
      posterUrl: poster ? new URL(decodeHtml(poster), W16_BASE_URL).toString() : undefined,
      language: mapFsVersion(textContent(version)),
      quality: textContent(quality),
    });
  }
  return cards;
}

export function buildW16ListingUrl(categoryPath: string, page: number): string {
  const url = new URL(categoryPath, W16_BASE_URL);
  if (page > 1) url.searchParams.set('cstart', String(page));
  return url.toString();
}

export async function fetchW16ListingPage(categoryPath: string, page: number): Promise<string> {
  const { data } = await axios.get(buildW16ListingUrl(categoryPath, page), {
    headers: { 'User-Agent': USER_AGENT, Referer: `${W16_BASE_URL}/` },
    timeout: 25000,
    responseType: 'text',
    transformResponse: [(body) => body],
  });
  if (typeof data !== 'string' || data.includes('Just a moment...')) {
    throw new Error('Réponse HTML W16 invalide ou challenge anti-bot.');
  }
  return data;
}

/** Les deux listings complets couvrent séries anime et films d'animation. */
export function parseW16AnimeCategoryPaths(_homeHtml: string): string[] {
  return [W16_ANIME_PATH, W16_ANIME_FILMS_PATH];
}

export interface W16SourceEpisode {
  title?: string;
  synopsis?: string;
  poster?: string;
  links: Array<{ language: 'VF' | 'VOSTFR'; host: string; url: string }>;
}

export interface W16AnimePayload {
  info?: Record<string, { title?: string; synopsis?: string; poster?: string }>;
  alt_titles?: Record<string, string>;
  episodes: Record<string, W16SourceEpisode>;
}

export async function fetchW16AnimePayload(newsId: string): Promise<W16AnimePayload | null> {
  if (!/^\d+$/.test(newsId)) return null;
  try {
    const { data } = await axios.get(`${W16_BASE_URL}/engine/ajax/manga_episodes_api.php`, {
      params: { id: newsId },
      headers: { 'User-Agent': USER_AGENT, Referer: `${W16_BASE_URL}/` },
      timeout: 20000,
    });
    if (!data || typeof data !== 'object') return null;

    const episodes: W16AnimePayload['episodes'] = {};
    for (const [languageKey, language] of [['vf', 'VF'], ['vostfr', 'VOSTFR']] as const) {
      const group = data[languageKey];
      if (!group || typeof group !== 'object') continue;
      for (const [episodeNumber, providers] of Object.entries(group)) {
        if (!providers || typeof providers !== 'object') continue;
        const episode = episodes[episodeNumber] || { links: [] };
        for (const [host, rawUrl] of Object.entries(providers as Record<string, unknown>)) {
          if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl)) continue;
          episode.links.push({ language, host, url: rawUrl });
        }
        episodes[episodeNumber] = episode;
      }
    }

    const info = data.info && typeof data.info === 'object' ? data.info : {};
    for (const [episodeNumber, episode] of Object.entries(episodes)) {
      const metadata = info[episodeNumber];
      if (metadata) Object.assign(episode, metadata);
    }

    return { info, alt_titles: data.alt_titles, episodes };
  } catch {
    return null;
  }
}

export function extractW16AlternativeTitles(titles?: Record<string, string>): string[] {
  if (!titles) return [];
  return [...new Set(Object.values(titles)
    .flatMap((value) => value.split(/[|~]/))
    .map((title) => textContent(title))
    .filter((title): title is string => Boolean(title)))];
}
