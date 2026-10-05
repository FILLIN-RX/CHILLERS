import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { LRUCache } from 'lru-cache';
import { matchesService } from '../matches/matches.service';
import type { LiveSourceMatch, ResolvedStreamResponse, StreamServer } from './streams.types';

const execFileAsync = promisify(execFile);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Clé XOR statique utilisée par LiveBall cl.min.js pour décoder le token `_xrq(...)`
// Aucun navigateur requis : déchiffrement pur en mémoire (0.01ms)
const TOKEN_XOR_KEY = 'q9!Vx2#mP4nL8wY5gT0dA3fH';

const LIVEBALL_BASE_DOMAINS = [
  process.env.LIVEBALL_DOMAIN || 'liveball.sx',
  'liveball.sx',
  'liveball.to',
  'liveball.net',
  'liveball.org',
];

// Cache des flux résolus (15 min)
const STREAM_CACHE = new LRUCache<string, ResolvedStreamResponse>({
  max: 100,
  ttl: 15 * 60 * 1000,
});

// Cache de la liste des matchs live (60 sec)
const MATCH_LIST_CACHE = new LRUCache<string, LiveSourceMatch[]>({
  max: 10,
  ttl: 60 * 1000,
});

function xorDecodeToken(token: string): string {
  try {
    const raw = Buffer.from(token, 'base64');
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw[i] ^ TOKEN_XOR_KEY.charCodeAt(i % TOKEN_XOR_KEY.length));
    }
    return out;
  } catch {
    return '';
  }
}

function normalizeTeam(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function areTeamsMatching(h1?: string, a1?: string, h2?: string, a2?: string): boolean {
  const normH1 = normalizeTeam(h1);
  const normA1 = normalizeTeam(a1);
  const normH2 = normalizeTeam(h2);
  const normA2 = normalizeTeam(a2);
  if (!normH1 || !normH2) return false;

  const directMatch =
    (normH1.includes(normH2) || normH2.includes(normH1)) &&
    (!normA1 || !normA2 || normA1.includes(normA2) || normA2.includes(normA1));

  const invertedMatch =
    (normH1.includes(normA2) || normA2.includes(normH1)) &&
    (!normA1 || !normH2 || normA1.includes(normH2) || normH2.includes(normA1));

  return directMatch || invertedMatch;
}

export class StreamsService {
  /**
   * Récupère la liste des matchs en direct sur LiveBall via requête HTTP directe
   */
  async getLiveBallMatches(): Promise<LiveSourceMatch[]> {
    const cached = MATCH_LIST_CACHE.get('liveball_matches');
    if (cached) return cached;

    for (const domain of LIVEBALL_BASE_DOMAINS) {
      try {
        const { data: html } = await axios.get<string>(`https://${domain}/`, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 8000,
          responseType: 'text',
        });

        if (!html || html.length < 500) continue;

        const matches: LiveSourceMatch[] = [];
        // Expression régulière rapide pour extraire les liens de match (/match/123456)
        const matchRegex = /href=["']\/match\/(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let m: RegExpExecArray | null;

        while ((m = matchRegex.exec(html)) !== null) {
          const matchId = m[1];
          const inner = m[2];
          // Extrait les noms des deux équipes
          const teamMatches = inner.match(/<span[^>]*class=["'][^"']*team[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi) || [];
          const homeMatch = teamMatches[0];
          const awayMatch = teamMatches[1];
          if (homeMatch && awayMatch) {
            const home = homeMatch.replace(/<[^>]+>/g, '').trim();
            const away = awayMatch.replace(/<[^>]+>/g, '').trim();
            if (home && away) {
              matches.push({
                id: matchId,
                status: 'live',
                home,
                away,
              });
            }
          }
        }

        if (matches.length > 0) {
          MATCH_LIST_CACHE.set('liveball_matches', matches);
          return matches;
        }
      } catch {
        // Essayer le domaine suivant
      }
    }

    return [];
  }

  /**
   * Résout directement le flux vidéo d'un match LiveBall sans AUCUN navigateur (0 Playwright)
   * Appelle l'endpoint interne /api/c/r avec le token déchiffré par XOR
   */
  async resolveLiveBallDirectStream(matchId: string): Promise<{ url: string; type: 'hls' | 'iframe' } | null> {
    if (!/^\d+$/.test(matchId)) return null;

    let html: string | null = null;
    let activeDomain = LIVEBALL_BASE_DOMAINS[0];

    // 1. Récupération directe du HTML de la page match en HTTP GET
    for (const domain of LIVEBALL_BASE_DOMAINS) {
      try {
        const res = await axios.get<string>(`https://${domain}/match/${matchId}`, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 7000,
          responseType: 'text',
        });
        if (res.data && (res.data.includes('_lbStreams') || res.data.includes('_xrq') || res.data.length > 1000)) {
          html = res.data;
          activeDomain = domain;
          break;
        }
      } catch {
        // Tentative curl ultra-rapide si axios bloque
        try {
          const curlRes = await execFileAsync('curl', [
            '-sSL',
            '--compressed',
            '-A', USER_AGENT,
            '--max-time', '6',
            `https://${domain}/match/${matchId}`,
          ]);
          if (curlRes.stdout && curlRes.stdout.length > 1000) {
            html = curlRes.stdout;
            activeDomain = domain;
            break;
          }
        } catch {}
      }
    }

    if (!html) return null;

    const candidateTokens: string[] = [];

    // 2. Format JSON moderne : window._lbStreams = { ... }
    const streamMatch = html.match(/window\._lbStreams\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (streamMatch) {
      try {
        const streams = JSON.parse(streamMatch[1]) as Record<string, any>;
        for (const key of Object.keys(streams)) {
          const item = streams[key];
          if (!item) continue;

          // Lien direct déjà résolu
          const directUrl = item.src || item.stream || item.url;
          if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
            const type = /\.m3u8($|\?)/i.test(directUrl) ? 'hls' : 'iframe';
            return { url: directUrl, type };
          }

          // Token à déchiffrer
          if (item.t && typeof item.t === 'string') {
            const decoded = xorDecodeToken(item.t);
            if (decoded && !candidateTokens.includes(decoded)) {
              candidateTokens.push(decoded);
            }
          }
        }
      } catch {}
    }

    // Format legacy : _xrq("...")
    const xrqMatches = html.matchAll(/_xrq\("([^"]+)"\)/g);
    for (const match of xrqMatches) {
      const decoded = xorDecodeToken(match[1]);
      if (decoded && !candidateTokens.includes(decoded)) {
        candidateTokens.push(decoded);
      }
    }

    // 3. Appel direct à l'API LiveBall POST /api/c/r (vitesse ~100ms)
    for (const token of candidateTokens) {
      for (const formatFlag of ['0', '1']) {
        try {
          const { data } = await axios.post<{ m?: string; d?: string }>(
            `https://${activeDomain}/api/c/r`,
            { t: token, f: formatFlag },
            {
              headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
                Referer: `https://${activeDomain}/match/${matchId}`,
                Origin: `https://${activeDomain}`,
              },
              timeout: 6000,
            }
          );

          if (data && data.d) {
            const rawUrl = Buffer.from(data.d, 'base64').toString('utf8').trim();
            let url = rawUrl;
            if (url.startsWith('//')) url = `https:${url}`;
            else if (url.startsWith('/')) url = `https://${activeDomain}${url}`;

            if (/^https?:\/\//i.test(url)) {
              const type: 'hls' | 'iframe' = data.m === 'f' || !/\.m3u8($|\?)/i.test(url) ? 'iframe' : 'hls';
              return { url, type };
            }
          }
        } catch {}
      }
    }

    // Fallback regex iframe dans le HTML si l'API a changé
    const iframeMatch = html.match(/<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/i);
    if (iframeMatch && iframeMatch[1] && !iframeMatch[1].includes('about:blank')) {
      return { url: iframeMatch[1], type: 'iframe' };
    }

    return null;
  }

  /**
   * Point d'entrée principal pour résoudre un flux vidéo à partir d'un match ESPN ou d'un ID direct
   */
  async resolveStreamForMatch(matchIdOrEspnId: string, homeQuery?: string, awayQuery?: string): Promise<ResolvedStreamResponse> {
    const cacheKey = `stream_${matchIdOrEspnId}_${homeQuery || ''}_${awayQuery || ''}`;
    const cached = STREAM_CACHE.get(cacheKey);
    if (cached) return cached;

    // 1. Si c'est directement un ID numérique de LiveBall
    if (/^\d{5,8}$/.test(matchIdOrEspnId) && !homeQuery && !awayQuery) {
      const stream = await this.resolveLiveBallDirectStream(matchIdOrEspnId);
      if (stream) {
        const response: ResolvedStreamResponse = {
          success: true,
          matchId: matchIdOrEspnId,
          status: 'resolved',
          source: 'liveball',
          sourceMatchId: matchIdOrEspnId,
          primaryUrl: stream.url,
          primaryType: stream.type,
          servers: [
            {
              id: 'server-1',
              name: 'Serveur HD 1 (Direct)',
              url: stream.url,
              type: stream.type,
              isPrimary: true,
            },
          ],
        };
        STREAM_CACHE.set(cacheKey, response);
        return response;
      }
    }

    // 2. Si c'est un match ESPN, on récupère le nom des équipes
    let homeName = homeQuery;
    let awayName = awayQuery;

    if (!homeName || !awayName) {
      try {
        const espnMatch = await matchesService.getMatchById(matchIdOrEspnId);
        if (espnMatch) {
          homeName = espnMatch.homeTeam?.name;
          awayName = espnMatch.awayTeam?.name;
        }
      } catch {}
    }

    if (!homeName || !awayName) {
      return {
        success: false,
        matchId: matchIdOrEspnId,
        status: 'not_found',
        servers: [],
        message: 'Impossible d\'identifier les équipes pour ce match',
      };
    }

    // 3. Recherche du match dans les agrégateurs directs
    const liveMatches = await this.getLiveBallMatches();
    const matched = liveMatches.find((lm) => areTeamsMatching(homeName, awayName, lm.home, lm.away));

    if (matched) {
      const stream = await this.resolveLiveBallDirectStream(matched.id);
      if (stream) {
        const response: ResolvedStreamResponse = {
          success: true,
          matchId: matchIdOrEspnId,
          homeTeam: homeName,
          awayTeam: awayName,
          status: 'resolved',
          source: 'liveball',
          sourceMatchId: matched.id,
          primaryUrl: stream.url,
          primaryType: stream.type,
          servers: [
            {
              id: 'liveball-hd',
              name: 'LiveBall · Flux HD Direct',
              url: stream.url,
              type: stream.type,
              isPrimary: true,
            },
          ],
        };
        STREAM_CACHE.set(cacheKey, response);
        return response;
      }
    }

    return {
      success: false,
      matchId: matchIdOrEspnId,
      homeTeam: homeName,
      awayTeam: awayName,
      status: 'not_found',
      servers: [],
      message: 'Aucun flux vidéo direct disponible pour le moment (match non commencé ou non couvert)',
    };
  }
}

export const streamsService = new StreamsService();
