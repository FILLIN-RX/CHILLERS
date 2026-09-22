import axios from 'axios';

const BASE_URL = 'https://flemmix.party';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface FlemmixStream {
  name: string;
  url: string;
  lang: 'VF' | 'VOSTFR' | 'UNKNOWN';
}

export interface FlemmixSearchResult {
  title: string;
  url: string;
  type: 'film' | 'serie';
}

export interface FlemmixResult {
  title: string;
  streams: FlemmixStream[];
  bestStream: FlemmixStream | null;
  source: 'flemmix';
}

/** Normalise un titre pour la comparaison (retire accents, ponctuation, casse) */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Détermine si un embed URL appartient à un hébergeur VF connu */
function detectLang(name: string, url: string): 'VF' | 'VOSTFR' | 'UNKNOWN' {
  const lowerName = name.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (lowerName.includes('vostfr') || lowerUrl.includes('vostfr')) return 'VOSTFR';
  if (lowerName.includes('vf') || lowerName.includes('vf ')) return 'VF';
  if (
    lowerName.includes('voe') ||
    lowerName.includes('lulutv') ||
    lowerName.includes('lustream') ||
    lowerName.includes('ddstream') ||
    lowerName.includes('save') ||
    lowerName.includes('uqload') ||
    lowerName.includes('vmoly') ||
    lowerName.includes('filelions') ||
    lowerName.includes('swish') ||
    lowerName.includes('netu') ||
    lowerName.includes('fmx') ||
    lowerName.includes('vidara')
  )
    return 'VF';

  return 'UNKNOWN';
}

/**
 * Classe les hébergeurs dans l'ordre de préférence connu (plus fiables en premier)
 */
function hostRank(url: string): number {
  if (url.includes('uqload')) return 1;
  if (url.includes('luluvdo')) return 2;    // LuLuTV / Lustream
  if (url.includes('vidmoly')) return 3;    // Vmoly
  if (url.includes('playmogo')) return 4;   // DdStream
  if (url.includes('savefiles')) return 5;  // Save
  if (url.includes('rebeccapracticeloss') || url.includes('voe')) return 6; // Voe
  if (url.includes('waaw1') || url.includes('netu')) return 7;
  if (url.includes('vidara')) return 8;
  if (url.includes('morencius')) return 9;  // Filelions
  if (url.includes('hanerix')) return 10;   // Swish
  if (url.includes('firestream')) return 11;
  if (url.includes('tipfly')) return 12;
  return 99;
}

/**
 * Recherche des films/séries via l'endpoint /xfsearch/{query}/
 * Fonctionne sans cookie et sans anti-bot.
 */
export async function searchFlemmix(query: string): Promise<FlemmixSearchResult[]> {
  const tryQueries = [
    query.trim(),
    query.trim().replace(/\s+/g, '-'),
    query.trim().split(/\s+/)[0], // Premier mot-clé principal
  ].filter(Boolean);

  const seenQueries = new Set<string>();

  for (const q of tryQueries) {
    if (seenQueries.has(q.toLowerCase())) continue;
    seenQueries.add(q.toLowerCase());

    try {
      const encoded = encodeURIComponent(q);
      const { data: html } = await axios.get(`${BASE_URL}/xfsearch/${encoded}/`, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
      });

      if (!html || typeof html !== 'string') continue;

      const results: FlemmixSearchResult[] = [];
      const regex = /href=['"]((https:\/\/flemmix\.party)?\/(film-en-streaming|serie-en-streaming|film-ancien)\/(\d+)-([^'"]+)\.html)['"]/gi;
      let match;

      while ((match = regex.exec(html)) !== null) {
        const url = match[1].startsWith('http')
          ? match[1]
          : `${BASE_URL}${match[1]}`;
        const rawType = match[3];
        const type = rawType.includes('serie') ? 'serie' : 'film';
        const slug = match[5] || match[4];
        const title = slug
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        if (!results.find((r) => r.url === url)) {
          results.push({ title, url, type });
        }
      }

      if (results.length > 0) {
        return results;
      }
    } catch (err: any) {
      // Ignorer l'erreur 404 pour tenter le mot-clé suivant
    }
  }

  return [];
}

/**
 * Extrait les lecteurs vidéo depuis la page d'un film/série Flemmix.
 * Les lecteurs sont dans des balises :
 *   <a onclick="loadVideo('https://...', this)"><span>NomHote</span></a>
 */
export async function extractFlemmixStreams(pageUrl: string): Promise<{ title: string; streams: FlemmixStream[] }> {
  try {
    const { data: html } = await axios.get(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`,
      },
      timeout: 15000,
    });

    if (!html || typeof html !== 'string') return { title: '', streams: [] };

    // Extraire le titre de la page
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const rawTitle = titleMatch
      ? titleMatch[1].replace(/\s*»\s*Flemmix.*$/i, '').trim()
      : '';

    // Extraire tous les appels loadVideo : onclick="loadVideo('URL', this)"
    const streams: FlemmixStream[] = [];
    const regex = /onclick=["']loadVideo\(['"]([^'"]+)['"],\s*this\)["'][^>]*>\s*<span>([^<]+)<\/span>/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const url = match[1].trim();
      const name = match[2].trim();

      if (!url || !url.startsWith('http')) continue;
      if (streams.find((s) => s.url === url)) continue;

      streams.push({
        name,
        url,
        lang: detectLang(name, url),
      });
    }

    return { title: rawTitle, streams };
  } catch (err: any) {
    console.error(`[Flemmix] Erreur extraction page "${pageUrl}":`, err.message);
    return { title: '', streams: [] };
  }
}

/**
 * Recherche et résout le meilleur stream disponible pour un film
 */
export async function getFlemmixMovie(title: string): Promise<FlemmixResult | null> {
  try {
    console.log(`[Flemmix] Recherche film: "${title}"`);

    const results = await searchFlemmix(title);
    if (results.length === 0) {
      console.log(`[Flemmix] Aucun résultat pour "${title}"`);
      return null;
    }

    // Filtrer uniquement les films (pas les séries)
    const filmResults = results.filter((r) => r.type === 'film');
    if (filmResults.length === 0) {
      console.log(`[Flemmix] Aucun film trouvé pour "${title}"`);
      return null;
    }

    // Trouver la meilleure correspondance parmi les résultats
    const searchNorm = normalize(title);
    
    // 1. Match exact
    let best = filmResults.find((r) => normalize(r.title) === searchNorm);

    // 2. Match contenant le titre ou contenu dans le titre
    if (!best) {
      best = filmResults.find((r) => {
        const rNorm = normalize(r.title);
        return rNorm.includes(searchNorm) || searchNorm.includes(rNorm);
      });
    }

    // 3. Premier résultat si proche
    if (!best && filmResults.length > 0) {
      const candidate = filmResults[0];
      const cNorm = normalize(candidate.title);
      const prefixLength = Math.min(5, searchNorm.length);
      if (cNorm.startsWith(searchNorm.slice(0, prefixLength))) {
        best = candidate;
      }
    }

    if (!best) {
      console.log(`[Flemmix] Aucune correspondance satisfaisante parmi ${filmResults.length} films pour "${title}"`);
      return null;
    }

    console.log(`[Flemmix] Film trouvé: ${best.url} (${best.title})`);
    const { title: resolvedTitle, streams } = await extractFlemmixStreams(best.url);

    if (streams.length === 0) {
      console.log(`[Flemmix] Aucun stream extrait pour "${title}"`);
      return null;
    }

    // Trier: VF en priorité, puis par rank hébergeur
    const sorted = [...streams].sort((a, b) => {
      const langRankA = a.lang === 'VF' ? 0 : a.lang === 'UNKNOWN' ? 1 : 2;
      const langRankB = b.lang === 'VF' ? 0 : b.lang === 'UNKNOWN' ? 1 : 2;
      if (langRankA !== langRankB) return langRankA - langRankB;
      return hostRank(a.url) - hostRank(b.url);
    });

    return {
      title: resolvedTitle || best.title,
      streams: sorted,
      bestStream: sorted[0] || null,
      source: 'flemmix',
    };
  } catch (err: any) {
    console.error(`[Flemmix] Erreur globale film "${title}":`, err.message);
    return null;
  }
}

/**
 * Recherche et résout le meilleur stream disponible pour un épisode de série
 */
export async function getFlemmixEpisode(
  title: string,
  season: number = 1,
  episode: number = 1
): Promise<FlemmixResult | null> {
  try {
    const targetSeason = season > 0 ? season : 1;
    const targetEp = episode > 0 ? episode : 1;
    console.log(`[Flemmix] Recherche série: "${title}" S${targetSeason}E${targetEp}`);

    // Recherche avec saison
    const seasonQuery = `${title} saison ${targetSeason}`;
    let results = await searchFlemmix(seasonQuery);

    // Fallback sans saison
    if (results.length === 0) {
      results = await searchFlemmix(title);
    }

    const serieResults = results.filter((r) => r.type === 'serie');
    if (serieResults.length === 0) {
      console.log(`[Flemmix] Aucune série trouvée pour "${title}"`);
      return null;
    }

    const titleNorm = normalize(title);
    const exactMatch = serieResults.find((r) => {
      const n = normalize(r.title);
      return n === titleNorm || n.includes(`saison${targetSeason}`) || n.includes(`season${targetSeason}`);
    });

    const best = exactMatch || serieResults[0];

    if (!normalize(best.title).includes(titleNorm.slice(0, Math.max(3, titleNorm.length - 3))) &&
        !titleNorm.includes(normalize(best.title).slice(0, Math.max(3, normalize(best.title).length - 3)))) {
      console.log(`[Flemmix] Correspondance série trop éloignée: "${best.title}" vs "${title}", skip.`);
      return null;
    }

    console.log(`[Flemmix] Série trouvée: ${best.url} (${best.title})`);
    const { title: resolvedTitle, streams } = await extractFlemmixStreams(best.url);

    if (streams.length === 0) {
      console.log(`[Flemmix] Aucun stream extrait pour "${title}" S${targetSeason}E${targetEp}`);
      return null;
    }

    const sorted = [...streams].sort((a, b) => {
      const langRankA = a.lang === 'VF' ? 0 : a.lang === 'UNKNOWN' ? 1 : 2;
      const langRankB = b.lang === 'VF' ? 0 : b.lang === 'UNKNOWN' ? 1 : 2;
      if (langRankA !== langRankB) return langRankA - langRankB;
      return hostRank(a.url) - hostRank(b.url);
    });

    return {
      title: resolvedTitle || `${best.title} S${targetSeason}E${targetEp}`,
      streams: sorted,
      bestStream: sorted[0] || null,
      source: 'flemmix',
    };
  } catch (err: any) {
    console.error(`[Flemmix] Erreur globale série "${title}":`, err.message);
    return null;
  }
}
