import axios from 'axios';
import querystring from 'querystring';
import Movie from '../../models/Movie';

const BASE_URL = 'https://french-stream.one';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface FrenchStreamSearchResult {
  title: string;
  url: string;
  poster: string;
}

export interface FrenchStreamVersion {
  label: string; // TRUEFRENCH, FRENCH, VOSTFR
  embedUrl: string;
}

export interface FrenchStreamDirectResult {
  title: string;
  quality: string;
  fileSize: string;
  streamUrl: string;
  embedUrl?: string;
  source: 'frenchstream';
}

function normalize(str: string): string {
  // Supprime l'année entre parenthèses comme (2026), (2025), etc.
  const withoutYear = str.replace(/\s*\(\s*\d{4}\s*\)\s*$/i, '');
  return withoutYear.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Recherche un film sur French-Stream via l'endpoint AJAX interne
 */
export async function searchFrenchStream(query: string): Promise<FrenchStreamSearchResult[]> {
  try {
    const postData = querystring.stringify({ query });
    const { data } = await axios.post(
      `${BASE_URL}/engine/ajax/controller.php?mod=search`,
      postData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${BASE_URL}/`
        },
        timeout: 10000
      }
    );

    if (!data || typeof data !== 'string') return [];

    const items: FrenchStreamSearchResult[] = [];
    const regex = /location\.href='([^']+)'[\s\S]*?<img src='([^']*)'[\s\S]*?<div class='search-title'>([\s\S]*?)<\/div>/gi;
    let match;

    while ((match = regex.exec(data)) !== null) {
      const relUrl = match[1];
      const poster = match[2];
      const title = match[3].replace(/\\'/g, "'").replace(/&amp;/g, '&').trim();
      items.push({
        url: relUrl.startsWith('http') ? relUrl : `${BASE_URL}${relUrl}`,
        poster,
        title
      });
    }

    return items;
  } catch (error: any) {
    console.error(`[FrenchStream] Erreur recherche "${query}":`, error.message);
    return [];
  }
}

/**
 * Extrait les liens de lecteurs Vidzy (TRUEFRENCH, FRENCH, VOSTFR) depuis la page du film
 */
export async function extractEmbedVersions(pageUrl: string): Promise<{ title: string; versions: FrenchStreamVersion[] }> {
  try {
    const { data: html } = await axios.get(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`
      },
      timeout: 15000
    });

    const titleMatch = html.match(/<h1[^>]*id="s-title"[^>]*>([\s\S]*?)<\/h1>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const versions: FrenchStreamVersion[] = [];
    const optionRegex = /<div class="option" data-url="([^"]+)"><span>([\s\S]*?)<\/span><\/div>/gi;
    let match;

    while ((match = optionRegex.exec(html)) !== null) {
      const embedUrl = match[1];
      const label = match[2].replace(/Télécharger en /i, '').trim();
      versions.push({ label, embedUrl });
    }

    // Si aucune version trouvée en HTML statique, interroger l'API interne film_api.php
    if (versions.length === 0) {
      const newsIdMatch = pageUrl.match(/\/(\d+)-/i) || html.match(/dle_news_id\s*=\s*['"](\d+)['"]/i);
      const isPageVostfr = /version-film[\/&amp;=]+VOSTFR/i.test(html) || /data-version="VOSTFR"/i.test(html);

      if (newsIdMatch && newsIdMatch[1]) {
        try {
          const apiUrl = `${BASE_URL}/engine/ajax/film_api.php?id=${newsIdMatch[1]}`;
          const { data: apiData } = await axios.get(apiUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Referer': pageUrl
            },
            timeout: 10000
          });

          if (apiData?.players && typeof apiData.players === 'object') {
            const preferredHosts = ['vidzy', 'uqload', 'premium', 'dood', 'voe', 'filmoon'];
            const allHosts = Object.keys(apiData.players).sort((a, b) => {
              const idxA = preferredHosts.indexOf(a.toLowerCase());
              const idxB = preferredHosts.indexOf(b.toLowerCase());
              const scoreA = idxA === -1 ? 99 : idxA;
              const scoreB = idxB === -1 ? 99 : idxB;
              return scoreA - scoreB;
            });

            for (const host of allHosts) {
              const playerData = apiData.players[host];
              if (!playerData || typeof playerData !== 'object') continue;

              const variants = [
                { key: 'vff', label: `${host.toUpperCase()} (TRUEFRENCH)` },
                { key: 'vf', label: `${host.toUpperCase()} (VF)` },
                { key: 'vfq', label: `${host.toUpperCase()} (VFQ)` },
                { key: 'default', label: isPageVostfr && !playerData.vf && !playerData.vff ? `${host.toUpperCase()} (VOSTFR)` : `${host.toUpperCase()} (FRENCH)` },
                { key: 'vostfr', label: `${host.toUpperCase()} (VOSTFR)` },
              ];

              const addedUrls = new Set<string>();
              for (const v of variants) {
                const url = playerData[v.key];
                if (url && typeof url === 'string' && !addedUrls.has(url)) {
                  addedUrls.add(url);
                  versions.push({ label: v.label, embedUrl: url });
                }
              }
            }
          }
        } catch (apiErr: any) {
          console.error(`[FrenchStream] Erreur appel film_api.php pour id=${newsIdMatch[1]}:`, apiErr.message);
        }
      }
    }

    return { title: rawTitle, versions };
  } catch (error: any) {
    console.error(`[FrenchStream] Erreur extraction ${pageUrl}:`, error.message);
    return { title: '', versions: [] };
  }
}

/**
 * Résout le lien direct MP4 1080p (Full HD) à partir de l'embed Vidzy
 */
export async function resolveVidzyDirectStream(embedUrl: string): Promise<{ streamUrl: string; fileSize: string } | null> {
  try {
    const dlPageUrl = embedUrl.replace('/embed-', '/d/').replace('.html', '_n.html');
    const { data: html } = await axios.get(dlPageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`
      },
      timeout: 15000
    });

    const titleMatch = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const fileSize = titleMatch ? titleMatch[1].trim() : '1080p Full HD';

    const opMatch = html.match(/name="op" value="([^"]+)"/);
    const idMatch = html.match(/name="id" value="([^"]+)"/);
    const modeMatch = html.match(/name="mode" value="([^"]+)"/);
    const hashMatch = html.match(/name="hash" value="([^"]+)"/);

    if (!hashMatch) return null;

    const form = {
      op: opMatch ? opMatch[1] : 'download_orig',
      id: idMatch ? idMatch[1] : '',
      mode: modeMatch ? modeMatch[1] : 'o',
      hash: hashMatch[1]
    };

    let origin = 'https://vidzy.cc';
    try {
      const u = new URL(embedUrl);
      origin = `${u.protocol}//${u.host}`;
    } catch {}

    const postData = querystring.stringify(form);
    const postRes = await axios.post(dlPageUrl, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': USER_AGENT,
        'Referer': dlPageUrl,
        'Origin': origin
      },
      timeout: 15000
    });

    const directLinks = postRes.data.match(/https?:\/\/[^"'\s\)]+\.(?:mp4|m3u8)[^"'\s\)]*/gi);
    if (directLinks && directLinks[0]) {
      return {
        streamUrl: directLinks[0],
        fileSize
      };
    }

    // Recherche via href dans balise <a> ou window.open
    const aMatch = postRes.data.match(/href="([^"]+\.mp4[^"]*)"/i);
    if (aMatch && aMatch[1]) {
      return {
        streamUrl: aMatch[1],
        fileSize
      };
    }

    return null;
  } catch (error: any) {
    console.error(`[FrenchStream] Erreur résolution Vidzy ${embedUrl}:`, error.message);
    return null;
  }
}

/**
 * Recherche et résout directement un film en Haute Résolution (1080p)
 */
export async function getFrenchStreamMovie(title: string): Promise<FrenchStreamDirectResult | null> {
  try {
    console.log(`[FrenchStream HQ] Recherche film 1080p: "${title}"`);
    const searchResults = await searchFrenchStream(title);
    if (searchResults.length === 0) return null;

    // Trouver la meilleure correspondance de titre (exacte en priorité)
    const searchNorm = normalize(title);
    const exactMatch = searchResults.find(item => normalize(item.title) === searchNorm);
    const best = exactMatch || searchResults[0];

    // Si aucun titre n'est proche du film demandé, rejeter pour éviter les faux films
    if (normalize(best.title) !== searchNorm && !normalize(best.title).startsWith(searchNorm)) {
      console.log(`[FrenchStream HQ] Correspondance trop éloignée pour "${title}" (trouvé: "${best.title}"), skip.`);
      return null;
    }

    console.log(`[FrenchStream HQ] Page trouvée: ${best.url} (${best.title})`);
    const { title: resolvedTitle, versions } = await extractEmbedVersions(best.url);
    if (versions.length === 0) return null;

    // 1. Tenter d'abord la résolution directe MP4 1080p sur les versions Vidzy
    // Trier les versions Vidzy par priorité audio : TRUEFRENCH > FRENCH / VF > VFQ > VOSTFR
    const langRank = (lbl: string) => {
      const u = lbl.toUpperCase();
      if (u.includes('TRUEFRENCH')) return 1;
      if (u.includes('FRENCH')) return 2;
      if (u.includes('VF')) return 3;
      if (u.includes('VFQ')) return 4;
      if (u.includes('VOSTFR')) return 5;
      return 6;
    };

    const vidzyVersions = versions
      .filter(v => v.embedUrl.includes('vidzy'))
      .sort((a, b) => langRank(a.label) - langRank(b.label));

    for (const v of vidzyVersions) {
      const direct = await resolveVidzyDirectStream(v.embedUrl);
      if (direct?.streamUrl) {
        console.log(`[FrenchStream HQ] Flux direct 1080p résolu (${v.label}): ${direct.streamUrl.slice(0, 70)}...`);
        return {
          title: resolvedTitle || best.title,
          quality: '1080p',
          fileSize: direct.fileSize,
          streamUrl: direct.streamUrl,
          embedUrl: v.embedUrl,
          source: 'frenchstream'
        };
      }
    }

    // 2. Si pas de direct Vidzy, trier toutes les versions disponibles :
    // Priorité langue : TRUEFRENCH > FRENCH > VF > VFQ > VOSTFR
    // Priorité hébergeur : Vidzy > Uqload > Premium > Dood > Voe > Filmoon
    const sortedVersions = [...versions].sort((a, b) => {
      const langRank = (lbl: string) => {
        const u = lbl.toUpperCase();
        if (u.includes('TRUEFRENCH')) return 1;
        if (u.includes('FRENCH')) return 2;
        if (u.includes('VFQ')) return 4;
        if (u.includes('VF')) return 3;
        if (u.includes('VOSTFR')) return 5;
        return 6;
      };
      return langRank(a.label) - langRank(b.label);
    });

    const chosenVersion = sortedVersions[0];
    if (chosenVersion?.embedUrl) {
      console.log(`[FrenchStream HQ] Lecteur embed sélectionné (${chosenVersion.label}): ${chosenVersion.embedUrl}`);
      return {
        title: resolvedTitle || best.title,
        quality: '1080p',
        fileSize: '1080p Full HD',
        streamUrl: chosenVersion.embedUrl,
        embedUrl: chosenVersion.embedUrl,
        source: 'frenchstream'
      };
    }

    return null;
  } catch (error: any) {
    console.error(`[FrenchStream HQ] Erreur globale pour "${title}":`, error.message);
    return null;
  }
}

/**
 * Extrait les lecteurs pour un épisode spécifique d'une série
 */
export async function extractEpisodeEmbedVersions(
  pageUrl: string,
  targetEpisode: number
): Promise<{ title: string; versions: FrenchStreamVersion[] }> {
  try {
    const { data: html } = await axios.get(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': `${BASE_URL}/`
      },
      timeout: 15000
    });

    const titleMatch = html.match(/<h1[^>]*id="s-title"[^>]*>([\s\S]*?)<\/h1>/i);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const newsIdMatch = pageUrl.match(/\/(\d+)-/i) || html.match(/dle_news_id\s*=\s*['"](\d+)['"]/i);
    const isPageVostfr = /version-film[\/&amp;=]+VOSTFR/i.test(html) || /data-version="VOSTFR"/i.test(html);

    const versions: FrenchStreamVersion[] = [];

    // 1. Interroger film_api.php avec le paramètre episode si newsId disponible
    if (newsIdMatch && newsIdMatch[1]) {
      try {
        const apiUrl = `${BASE_URL}/engine/ajax/film_api.php?id=${newsIdMatch[1]}&episode=${targetEpisode}`;
        const { data: apiData } = await axios.get(apiUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Referer': pageUrl
          },
          timeout: 10000
        });

        if (apiData?.players && typeof apiData.players === 'object') {
          const preferredHosts = ['vidzy', 'uqload', 'premium', 'dood', 'voe', 'filmoon'];
          const allHosts = Object.keys(apiData.players).sort((a, b) => {
            const idxA = preferredHosts.indexOf(a.toLowerCase());
            const idxB = preferredHosts.indexOf(b.toLowerCase());
            const scoreA = idxA === -1 ? 99 : idxA;
            const scoreB = idxB === -1 ? 99 : idxB;
            return scoreA - scoreB;
          });

          for (const host of allHosts) {
            const playerData = apiData.players[host];
            if (!playerData || typeof playerData !== 'object') continue;

            const variants = [
              { key: 'vff', label: `${host.toUpperCase()} (TRUEFRENCH)` },
              { key: 'vf', label: `${host.toUpperCase()} (VF)` },
              { key: 'vfq', label: `${host.toUpperCase()} (VFQ)` },
              { key: 'default', label: isPageVostfr && !playerData.vf && !playerData.vff ? `${host.toUpperCase()} (VOSTFR)` : `${host.toUpperCase()} (FRENCH)` },
              { key: 'vostfr', label: `${host.toUpperCase()} (VOSTFR)` },
            ];

            const addedUrls = new Set<string>();
            for (const v of variants) {
              const url = playerData[v.key];
              if (url && typeof url === 'string' && !addedUrls.has(url)) {
                addedUrls.add(url);
                versions.push({ label: v.label, embedUrl: url });
              }
            }
          }
        }
      } catch (apiErr: any) {
        console.error(`[FrenchStream] Erreur film_api.php série id=${newsIdMatch[1]} ep=${targetEpisode}:`, apiErr.message);
      }
    }

    // 2. Si aucune version trouvée via l'API, chercher dans le HTML les liens de l'épisode
    if (versions.length === 0) {
      // Chercher des blocs d'options dédiés à l'épisode
      const optionRegex = /<div class="option" data-url="([^"]+)"><span>([\s\S]*?)<\/span><\/div>/gi;
      let match;
      while ((match = optionRegex.exec(html)) !== null) {
        const embedUrl = match[1];
        const label = match[2].replace(/Télécharger en /i, '').trim();
        versions.push({ label, embedUrl });
      }
    }

    return { title: rawTitle, versions };
  } catch (error: any) {
    console.error(`[FrenchStream] Erreur extraction épisode ${pageUrl}:`, error.message);
    return { title: '', versions: [] };
  }
}

/**
 * Recherche et résout directement un épisode de série en Haute Résolution (1080p)
 */
export async function getFrenchStreamEpisode(
  title: string,
  season: number = 1,
  episode: number = 1
): Promise<FrenchStreamDirectResult | null> {
  try {
    const targetSeason = season > 0 ? season : 1;
    const targetEp = episode > 0 ? episode : 1;
    console.log(`[FrenchStream HQ] Recherche série 1080p: "${title}" S${targetSeason}E${targetEp}`);

    // Recherche avec titre + saison
    const seasonQuery = `${title} Saison ${targetSeason}`;
    let searchResults = await searchFrenchStream(seasonQuery);

    if (searchResults.length === 0) {
      // Fallback recherche avec titre simple
      searchResults = await searchFrenchStream(title);
    }

    if (searchResults.length === 0) return null;

    // Filtrer les résultats pour trouver la saison correspondante
    const searchNorm = normalize(seasonQuery);
    const titleNorm = normalize(title);
    
    // Préférer un résultat qui contient explicitement la saison
    const exactSeasonMatch = searchResults.find(item => {
      const itNorm = normalize(item.title);
      return itNorm.includes(`saison${targetSeason}`) || itNorm.includes(`season${targetSeason}`) || itNorm === searchNorm;
    });

    const best = exactSeasonMatch || searchResults[0];

    if (!normalize(best.title).includes(titleNorm) && !titleNorm.includes(normalize(best.title))) {
      console.log(`[FrenchStream HQ] Série "${best.title}" trop éloignée de "${title}", skip.`);
      return null;
    }

    console.log(`[FrenchStream HQ] Page série trouvée: ${best.url} (${best.title})`);
    const { title: resolvedTitle, versions } = await extractEpisodeEmbedVersions(best.url, targetEp);

    if (versions.length === 0) {
      console.log(`[FrenchStream HQ] Aucune version pour "${title}" S${targetSeason}E${targetEp}`);
      return null;
    }

    const langRank = (lbl: string) => {
      const u = lbl.toUpperCase();
      if (u.includes('TRUEFRENCH')) return 1;
      if (u.includes('FRENCH')) return 2;
      if (u.includes('VF')) return 3;
      if (u.includes('VFQ')) return 4;
      if (u.includes('VOSTFR')) return 5;
      return 6;
    };

    // 1. Tenter la résolution directe Vidzy 1080p
    const vidzyVersions = versions
      .filter(v => v.embedUrl.includes('vidzy'))
      .sort((a, b) => langRank(a.label) - langRank(b.label));

    for (const v of vidzyVersions) {
      const direct = await resolveVidzyDirectStream(v.embedUrl);
      if (direct?.streamUrl) {
        console.log(`[FrenchStream HQ] Flux série direct 1080p résolu (${v.label}): ${direct.streamUrl.slice(0, 70)}...`);
        return {
          title: resolvedTitle || `${best.title} S${targetSeason}E${targetEp}`,
          quality: '1080p',
          fileSize: direct.fileSize,
          streamUrl: direct.streamUrl,
          embedUrl: v.embedUrl,
          source: 'frenchstream'
        };
      }
    }

    // 2. Fallback embed
    const sortedVersions = [...versions].sort((a, b) => langRank(a.label) - langRank(b.label));
    const chosen = sortedVersions[0];
    if (chosen?.embedUrl) {
      console.log(`[FrenchStream HQ] Lecteur embed série sélectionné (${chosen.label}): ${chosen.embedUrl}`);
      return {
        title: resolvedTitle || `${best.title} S${targetSeason}E${targetEp}`,
        quality: '1080p',
        fileSize: '1080p Full HD',
        streamUrl: chosen.embedUrl,
        embedUrl: chosen.embedUrl,
        source: 'frenchstream'
      };
    }

    return null;
  } catch (error: any) {
    console.error(`[FrenchStream HQ] Erreur série pour "${title}":`, error.message);
    return null;
  }
}
