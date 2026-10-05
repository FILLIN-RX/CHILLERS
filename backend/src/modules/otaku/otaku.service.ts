import axios from 'axios';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';

const BASE_URL = 'https://www.open-otaku.me';

let scrapeInProgress = false;

function cleanTitle(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(saison|season)\s*\d+/gi, '')
    .replace(/\b(19\d\d|20\d\d)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function areTitlesMatching(searchTitle: string, candidateTitle: string): boolean {
  const s = cleanTitle(searchTitle);
  const c = cleanTitle(candidateTitle);
  if (!s || !c) return false;
  if (s === c) return true;
  if (c.startsWith(s) && (c.length - s.length <= 15)) return true;
  if (s.startsWith(c) && (s.length - c.length <= 10)) return true;
  return false;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}

function toDownloadUrl(url: string): string {
  if (!url) return '';
  if (url.includes('vidzy.')) return url.replace('/embed-', '/d/').replace('.html', '_n.html');
  if (url.includes('luluvid.')) return url.replace('/embed-', '/d/').replace('.html', '');
  return url;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, params: any, retries = 3, delayMs = 3000): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await axios.get(url, {
        params,
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      return data;
    } catch (err: any) {
      const is429 = err?.response?.status === 429 || err?.message?.includes('429');
      if (is429 && attempt < retries) {
        const wait = delayMs * attempt;
        console.log(`[Otaku Service] [429 RateLimit] Pause ${wait / 1000}s avant retry...`);
        await sleep(wait);
        continue;
      }
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
  return null;
}

async function getDirectLink(embedUrl: string): Promise<string | null> {
  try {
    const dlUrl = toDownloadUrl(embedUrl);
    if (!dlUrl) return null;
    const data = await fetchWithRetry(`${BASE_URL}/api/dl`, { url: dlUrl });
    return data?.success && data?.downloadUrl ? data.downloadUrl : null;
  } catch {
    return null;
  }
}

export interface OtakuResult {
  titre: string;
  lien: string;
  pagePath?: string;
  source: 'otaku';
}

export async function searchOtaku(
  title: string,
  type: 'movie' | 'series' = 'movie',
  season?: number,
  episode?: number,
  language: string = 'fr',
  year?: number,
  knownPageId?: string
): Promise<OtakuResult | null> {
  try {
    const targetSeason = season && season > 0 ? season : 1;
    const targetEpisode = episode && episode > 0 ? episode : 1;
    const labelSeasonEp = type === 'series' ? ` S${targetSeason}E${targetEpisode}` : '';
    console.log(`[Otaku Direct API] Searching "${title}"${labelSeasonEp} (type: ${type}, year: ${year || 'non spécifiée'}, lang: ${language}, knownId: ${knownPageId || 'aucun'})`);

    let bestItem: { id: string; title: string; poster?: string } | null = null;
    let watch: any = null;

    // 1. Tenter un chargement direct sans recherche si un identifiant/pageId est déjà connu en DB
    if (knownPageId) {
      console.log(`[Otaku] [Direct Cache] Tentative directe sur ID mémorisé: "${knownPageId}"`);
      try {
        const directWatch = await fetchWithRetry(`${BASE_URL}/api/fs-watch`, { id: knownPageId });
        if (directWatch && (directWatch.episodes || directWatch.players)) {
          watch = directWatch;
          bestItem = { id: knownPageId, title: directWatch?.meta?.title || title };
          console.log(`[Otaku] [Direct Cache] Succès direct sur ID "${knownPageId}" sans recherche !`);
        } else {
          console.log(`[Otaku] [Direct Cache] ID mémorisé sans données valides, bascule vers recherche.`);
        }
      } catch (err: any) {
        console.warn(`[Otaku] [Direct Cache] Échec ID mémorisé (${err.message}), fallback recherche.`);
      }
    }

    // 2. Si pas d'ID mémorisé ou échec, faire la recherche classique
    if (!watch || !bestItem) {
      // Recherche directe via l'API interne d'OpenOtaku
      // Si série avec saison > 1 et titre ne contenant pas "saison", tenter d'abord avec le libellé saison
      let queryTitle = title;
      if (type === 'series' && targetSeason > 1 && !/saison\s*\d+/i.test(title)) {
        queryTitle = `${title} Saison ${targetSeason}`;
      }

      let data = await fetchWithRetry(`${BASE_URL}/api/fs-search`, { q: queryTitle });
      let results: Array<{ id: string; title: string; poster?: string }> = data?.results || [];

      // Fallback recherche avec titre brut si aucun résultat avec le suffixe saison
      if (results.length === 0 && queryTitle !== title) {
        data = await fetchWithRetry(`${BASE_URL}/api/fs-search`, { q: title });
        results = data?.results || [];
      }

      if (results.length === 0) {
        console.log(`[Otaku] Aucun résultat trouvé pour "${title}"`);
        return null;
      }

      // Trouver la meilleure correspondance de titre
      const matchingItems: Array<{ id: string; title: string; poster?: string }> = [];

      for (const item of results) {
        if (areTitlesMatching(queryTitle, item.title || '') || areTitlesMatching(title, item.title || '')) {
          matchingItems.push(item);
        }
      }

      if (matchingItems.length === 0) {
        console.log(`[Otaku] Correspondance trop éloignée pour "${title}" (trouvé: "${results[0]?.title}"), skip.`);
        return null;
      }

      bestItem = matchingItems[0];

      // Pour les séries, cibler la saison demandée
      if (type === 'series' && matchingItems.length > 1) {
        const seasonRegex = new RegExp(`saison\\s*0*${targetSeason}\\b|season\\s*0*${targetSeason}\\b|s0*${targetSeason}\\b`, 'i');
        const exactSeason = matchingItems.find((it) => seasonRegex.test(it.title || ''));
        if (exactSeason) {
          bestItem = exactSeason;
          console.log(`[Otaku] Match exact saison ${targetSeason} trouvé: "${bestItem.title}"`);
        } else if (targetSeason === 1) {
          const s1Item = matchingItems.find((it) => /saison\s*1\b|season\s*1\b/i.test(it.title || '') || !/saison\s*\d+/i.test(it.title || ''));
          if (s1Item) {
            bestItem = s1Item;
            console.log(`[Otaku] Match saison 1 par défaut: "${bestItem.title}"`);
          }
        }
      }

      // Si plusieurs candidats pour un film et qu'une année est spécifiée, inspecter les détails pour trouver l'année exacte
      if (type === 'movie' && year && matchingItems.length > 1) {
        for (const cand of matchingItems.slice(0, 4)) {
          const w = await fetchWithRetry(`${BASE_URL}/api/fs-watch`, { id: cand.id });
          if (w?.meta?.year) {
            const candYear = parseInt(w.meta.year, 10);
            if (!isNaN(candYear) && Math.abs(candYear - year) <= 1) {
              bestItem = cand;
              watch = w;
              console.log(`[Otaku] Match exact année trouvé: "${cand.title}" (ID: ${cand.id}, Année: ${candYear}) pour cible ${year}`);
              break;
            }
          }
        }
      }

      // Récupérer les détails de visionnage si pas déjà récupérés
      if (!watch && bestItem) {
        watch = await fetchWithRetry(`${BASE_URL}/api/fs-watch`, { id: bestItem.id });
      }
    }

    if (!bestItem || !watch) {
      return null;
    }

    const savedPageId = bestItem.id;

    const detailTitle = watch?.meta?.title || bestItem.title || title;

    if (type === 'series') {
      const rawEps = watch?.episodes || {};
      const vfMap = rawEps.vf || {};
      const vostfrMap = rawEps.vostfr || {};
      let version = vfMap;
      if (language === 'vostfr') {
        version = Object.keys(vostfrMap).length > 0 ? vostfrMap : vfMap;
      } else {
        version = Object.keys(vfMap).length > 0 ? vfMap : vostfrMap;
      }
      
      // Chercher la clé de l'épisode correspondant (ex: "5", ou "05", ou premier disponible)
      const epKey = String(targetEpisode);
      const epPadded = String(targetEpisode).padStart(2, '0');
      const matchedKey = Object.keys(version).find(k => k === epKey || k === epPadded || k.replace(/\D/g, '') === epKey) || Object.keys(version)[0];

      if (!matchedKey) {
        console.log(`[Otaku] Aucun épisode trouvé dans la liste pour "${title}" S${targetSeason}E${targetEpisode}`);
        return null;
      }

      const players = version[matchedKey] || {};
      const embedUrl = players.vidzy || players.luluvid || (Object.values(players)[0] as string) || '';
      
      if (embedUrl) {
        const link = await getDirectLink(embedUrl);
        if (link) {
          console.log(`[Otaku] Épisode S${targetSeason}E${targetEpisode} résolu (${matchedKey}): ${link.slice(0, 60)}...`);
          return { titre: detailTitle, lien: link, pagePath: savedPageId, source: 'otaku' };
        }
        // Si le lien direct n'a pas pu être extrait, renvoyer l'embedUrl
        return { titre: detailTitle, lien: embedUrl, pagePath: savedPageId, source: 'otaku' };
      }
    } else {
      const players = watch?.players || {};
      let embedUrl = '';
      if (language === 'vostfr') {
        embedUrl =
          players.vidzy?.vostfr ||
          players.vidzy?.default ||
          players.premium?.default ||
          '';
      } else {
        embedUrl =
          players.vidzy?.vff ||
          players.vidzy?.vf ||
          players.vidzy?.default ||
          players.premium?.default ||
          '';
      }

      if (!embedUrl) {
        embedUrl =
          players.vidzy?.default ||
          players.vidzy?.vff ||
          players.vidzy?.vf ||
          players.vidzy?.vostfr ||
          players.premium?.default ||
          (Object.values(players)[0] as any)?.default ||
          '';
      }

      if (embedUrl) {
        const link = await getDirectLink(embedUrl);
        if (link) {
          return { titre: detailTitle, lien: link, pagePath: savedPageId, source: 'otaku' };
        }
        return { titre: detailTitle, lien: embedUrl, pagePath: savedPageId, source: 'otaku' };
      }
    }

    console.log(`[Otaku] Lien direct non trouvé pour "${title}"`);
    return null;
  } catch (err: any) {
    console.error(`[Otaku] Erreur recherche API pour "${title}":`, err.message);
    return null;
  }
}

export async function getSpecificEpisodeLink(
  page: any,
  episodeNumber: string,
  previousLink?: string | null,
  seriesIdOrTitle?: string
): Promise<string | null> {
  try {
    const targetTitle = seriesIdOrTitle || (page?.url ? new URL(page.url()).searchParams.get('watch_fs') : null);
    if (!targetTitle) return null;

    let fsId = targetTitle;
    if (isNaN(Number(targetTitle))) {
      const { data } = await axios.get(`${BASE_URL}/api/fs-search`, {
        params: { q: targetTitle },
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      fsId = data?.results?.[0]?.id;
    }

    if (!fsId) return null;

    const { data: watch } = await axios.get(`${BASE_URL}/api/fs-watch`, {
      params: { id: fsId },
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const rawEps = watch?.episodes || {};
    const vfMap = rawEps.vf || {};
    const vostfrMap = rawEps.vostfr || {};
    const version = Object.keys(vfMap).length > 0 ? vfMap : vostfrMap;
    const epNumOnly = episodeNumber.replace(/\D/g, '') || '1';
    const players = version[epNumOnly] || Object.values(version)[0] || {};
    const embedUrl = (players as any).vidzy || (players as any).luluvid || (Object.values(players)[0] as string) || '';

    if (embedUrl) {
      return await getDirectLink(embedUrl);
    }
    return null;
  } catch (err: any) {
    console.error(`[Otaku] Erreur getSpecificEpisodeLink:`, err.message);
    return null;
  }
}

export async function searchAndNavigateToSeries(page: any, title: string): Promise<boolean> {
  return true;
}

export async function searchAndCache(
  title: string,
  type: 'movie' | 'series' = 'movie'
): Promise<OtakuResult | null> {
  if (scrapeInProgress) {
    console.log(`[Otaku] Scrape déjà en cours, skip "${title}"`);
    return null;
  }

  scrapeInProgress = true;
  try {
    const result = await searchOtaku(title, type);
    if (result) {
      if (type === 'series') {
        const existing = await Serie.findOne({ titre: result.titre });
        if (!existing) {
          await Serie.create({
            titre: result.titre,
            pageUrl: '',
            episodes: [{ episode: 'Ép 1', lien: result.lien }]
          });
          console.log(`[Otaku] Série mise en cache : ${result.titre}`);
        }
      } else {
        const existing = await Movie.findOne({ titre: result.titre });
        if (!existing) {
          await Movie.create({
            titre: result.titre,
            pageUrl: '',
            lien: result.lien
          });
          console.log(`[Otaku] Film mis en cache : ${result.titre}`);
        }
      }
    }
    return result;
  } finally {
    scrapeInProgress = false;
  }
}

