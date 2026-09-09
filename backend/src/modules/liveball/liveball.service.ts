import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { LRUCache } from 'lru-cache';

const execFileAsync = promisify(execFile);

export interface LiveBallMatch {
  id: string;
  status: 'live' | 'upcoming';
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  score?: string;
  minute?: string;
  startTs?: number;
  league?: string;
}

// Flux résolu d'un match : soit un HLS natif (m3u8), soit une URL de player
// à embarquer en iframe (format "f" renvoyé par /api/c/r pour de nombreux
// matchs dont certains de la Champions League).
export interface ResolvedStream {
  url: string;
  type: 'hls' | 'iframe';
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CACHE = new LRUCache<string, LiveBallMatch[]>({
  max: 20,
  ttl: 60_000, // cache 60s
});

// Clé XOR statique utilisée par cl.min.js pour decoder le token `_xrq(...)`
// présent dans la page d'un match. POST t = XOR(atob(token), clé répétée).
const TOKEN_XOR_KEY = 'q9!Vx2#mP4nL8wY5gT0dA3fH';

// Les URLs m3u8 (token signé) et URLs de player iframe renvoyées
// par /api/c/r sont mises en cache 20 minutes (pour permettre la rotation des tokens).
const STREAM_CACHE = new LRUCache<string, ResolvedStream>({
  max: 50,
  ttl: 20 * 60_000, // cache 20min
});

export function invalidateStreamCache(matchId: string): void {
  STREAM_CACHE.delete(matchId);
}

function xorDecodeToken(token: string): string {
  const raw = Buffer.from(token, 'base64');
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw[i] ^ TOKEN_XOR_KEY.charCodeAt(i % TOKEN_XOR_KEY.length));
  }
  return out;
}

// liveball.sx est derrière un challenge Cloudflare (JA3/TLS fingerprinting) :
// axios/node-fetch sont systématiquement bloqués (403 "Just a moment..."),
// alors que curl (HTTP/2) avec des headers correct passe souvent.
// On essaie curl d'abord, puis axios comme fallback.
async function fetchHtmlWithCurl(url: string): Promise<string> {
  try {
    // Try curl with comprehensive browser-like headers
    const { stdout } = await execFileAsync(
      'curl',
      [
        '-sSL',
        '--http2',  // Use HTTP/2
        '-A', USER_AGENT,
        '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        '-H', 'Accept-Language: en-US,en;q=0.9,fr;q=0.8,ru;q=0.7',
        '-H', 'Accept-Encoding: gzip, deflate, br',
        '-H', 'DNT: 1',
        '-H', 'Connection: keep-alive',
        '-H', 'Upgrade-Insecure-Requests: 1',
        '-H', 'Sec-Fetch-Dest: document',
        '-H', 'Sec-Fetch-Mode: navigate',
        '-H', 'Sec-Fetch-Site: none',
        '-H', 'Sec-Fetch-User: ?1',
        '-H', 'Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        '-H', 'Sec-Ch-Ua-Mobile: ?0',
        '-H', 'Sec-Ch-Ua-Platform: "Linux"',
        '-H', 'Cache-Control: max-age=0',
        '--compressed',
        '--max-time', '20',
        url,
      ],
      { maxBuffer: 4 * 1024 * 1024 }
    );
    
    // Check if we got Cloudflare challenge instead of real content
    if (stdout.includes('Just a moment') || stdout.includes('challenges.cloudflare.com') || stdout.includes('error code') || stdout.trim().length < 500) {
      throw new Error('Cloudflare challenge or empty response detected');
    }
    
    return stdout;
  } catch (curlErr) {
    // Fallback: try axios with different user agent
    try {
      const { data } = await axios.get<string>(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ru;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        timeout: 15_000,
        responseType: 'text',
        maxRedirects: 10,
      });
      
      if (data.includes('Just a moment') || data.includes('challenges.cloudflare.com')) {
        throw new Error('Cloudflare challenge detected in axios response');
      }
      
      return data;
    } catch (axiosErr) {
      console.error(`[LiveBall] Fetch failed. curl: ${curlErr instanceof Error ? curlErr.message : 'unknown'}, axios: ${axiosErr instanceof Error ? axiosErr.message : 'unknown'}`);
      throw new Error('Unable to bypass Cloudflare - LiveBall.sx is blocking access');
    }
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractMinute(block: string): string | undefined {
  const m = block.match(/\b(\d{1,2}')\b/);
  return m ? m[1] : undefined;
}

// LiveBall affiche les noms d'équipes en russe (cyrillique). On mappe les
// clubs connus vers leur nom officiel, puis on translittère le reste.
const TEAM_NAMES: Record<string, string> = {
  // UEFA Champions League (matchs actuels)
  'АЕК Афины': 'AEK Athens',
  'Ласк': 'LASK',
  'Брюгге': 'Club Brugge',
  'Астон Вилла': 'Aston Villa',
  'Боруссия Д': 'Borussia Dortmund',
  'Вильярреал': 'Villarreal',
  'Порту': 'FC Porto',
  'Манчестер Сити': 'Manchester City',
  'Лилль': 'Lille',
  'Реал Бетис': 'Real Betis',
  'Реал Мадрид': 'Real Madrid',
  'Интер': 'Inter Milan',
  'Барселона': 'Barcelona',
  'Фейеноорд': 'Feyenoord',
  'Штутгарт': 'VfB Stuttgart',
  'Викинг': 'Viking',
  'Ливерпуль': 'Liverpool',
  'Атлетико Мадрид': 'Atlético Madrid',
  'Наполи': 'Napoli',
  'Арсенал': 'Arsenal',
  'ПСЖ': 'Paris Saint-Germain',
  'Слован': 'Slovan Bratislava',
  'Спортинг': 'Sporting CP',
  'Галатасарай': 'Galatasaray',
  'Фенербахче': 'Fenerbahçe',
  'Рома': 'Roma',
  'ПСВ': 'PSV Eindhoven',
  'Шахтер': 'Shakhtar Donetsk',
  'Бавария': 'Bayern Munich',
  'Будё-Глимт': 'Bodø/Glimt',
  'Кальчо Комо': 'Como',
  'РБ Лейпциг': 'RB Leipzig',
  'Манчестер Юнайтед': 'Manchester United',
  'Сабах': 'Sabah',
  'Славия Прага': 'Slavia Prague',
  'Ланс': 'Lens',
  // Équipes de jeunes (suffixe U-XX)
  'Брюгге (U-19)': 'Club Brugge (U-19)',
  'Астон Вилла (U-19)': 'Aston Villa (U-19)',
  'Лилль (U-19)': 'Lille (U-19)',
  'Реал Бетис (U-19)': 'Real Betis (U-19)',
  'Боруссия Д (U-19)': 'Borussia Dortmund (U-19)',
  'Вильярреал (U-19)': 'Villarreal (U-19)',
  'Реал Мадрид (U-19)': 'Real Madrid (U-19)',
  'Интер (U-19)': 'Inter Milan (U-19)',
  // Sélections (jeunes femmes)
  'Бенин U-20 (жен)': 'Benin U-20 (Women)',
  'Аргентина U-20 (жен)': 'Argentina U-20 (Women)',
  'Бразилия U-20 (жен)': 'Brazil U-20 (Women)',
  'Канада U-20 (жен)': 'Canada U-20 (Women)',
  'Англия U-20 (жен)': 'England U-20 (Women)',
  'Танзания U-20 (жен)': 'Tanzania U-20 (Women)',
  // Autres ligues / coupes vues sur la homepage
  'Равшан': 'Ravshan',
  'Регар-ТадАЗ': 'Regar-TadAZ',
  'Худжанд': 'Khujand',
  'Рязань': 'Ryazan',
  'Спартак Кострома': 'Spartak Kostroma',
  'Вардарац': 'Vardarac',
  'Хайдук': 'Hajduk Split',
  'Истра': 'Istra',
  'Аль-Иттифак': 'Al-Ettifaq',
  'Аль-Фейсали': 'Al-Faisaly',
  'Аль-Хазм': 'Al-Hazem',
  'Аль-Таавун': 'Al-Taawoun',
  // Clubs majeurs (couverture courante)
  'Динамо Киев': 'Dynamo Kyiv',
  'Динамо Загреб': 'Dinamo Zagreb',
  'Зенит': 'Zenit',
  'ЦСКА': 'CSKA Moscow',
  'Спартак Москва': 'Spartak Moscow',
  'Локомотив Москва': 'Lokomotiv Moscow',
  'Краснодар': 'Krasnodar',
  'Ростов': 'Rostov',
  'Ювентус': 'Juventus',
  'Милан': 'AC Milan',
  'Лацио': 'Lazio',
  'Аталанта': 'Atalanta',
  'Фиорентина': 'Fiorentina',
  'Тоттенхэм': 'Tottenham',
  'Челси': 'Chelsea',
  'Эвертон': 'Everton',
  'Ньюкасл': 'Newcastle',
  'Вест Хэм': 'West Ham',
  'Аякс': 'Ajax',
  'АЗ Алкмар': 'AZ Alkmaar',
  'Твенте': 'Twente',
  'Реал Сосьедад': 'Real Sociedad',
  'Севилья': 'Sevilla',
  'Валенсия': 'Valencia',
  'Атлетик Бильбао': 'Athletic Bilbao',
  'Бенфика': 'Benfica',
  'Байер': 'Bayer Leverkusen',
  'Боруссия М': 'Borussia Mönchengladbach',
  'Вольфсбург': 'Wolfsburg',
  'Франкфурт': 'Eintracht Frankfurt',
  'Монако': 'Monaco',
  'Марсель': 'Marseille',
  'Лион': 'Lyon',
  'Ницца': 'Nice',
  'Ренн': 'Rennes',
  'Бешикташ': 'Beşiktaş',
  'Трабзонспор': 'Trabzonspor',
  'Базель': 'Basel',
  'Янг Бойз': 'Young Boys',
  'Црвена Звезда': 'Red Star Belgrade',
  'Партизан': 'Partizan Belgrade',
  'Рейнджерс': 'Rangers',
  'Селтик': 'Celtic',
  'Гент': 'Gent',
  'Андерлехт': 'Anderlecht',
};

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterate(name: string): string {
  return name.replace(/[а-яёА-ЯЁ]/g, (ch) => {
    const lower = ch.toLowerCase();
    return CYRILLIC_MAP[lower] ?? ch;
  });
}

// Traduit les noms d'équipes russes vers leurs noms officiels :
// dictionnaire d'abord, puis translittération, puis suffixes (U-19, féminin).
function normalizeTeamName(name: string): string {
  const trimmed = name.trim();
  if (TEAM_NAMES[trimmed]) return TEAM_NAMES[trimmed];

  let n = trimmed
    .replace(/\(жен\)/g, '(Women)')
    .replace(/\(мол\)/g, '(U-21)');

  const translit = transliterate(n);
  if (translit === n) return n;
  // Met en majuscule le premier caractère de chaque mot translittéré.
  return translit.replace(/(^|\s|-)([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

// Sur les pages /league/... les logos sont lazy-loadés : `src` est un GIF
// transparent 1x1, l'URL réelle est dans `data-src`. On extrait l'URL utile.
function teamLogo(block: string, side: 'left' | 'right'): string | undefined {
  const tag = block.match(new RegExp(`<img[^>]*class="team_logo logo_${side}[^"]*"[^>]*>`, 'i'))?.[0];
  if (!tag) return undefined;
  for (const prop of ['data-src', 'src']) {
    const m = tag.match(new RegExp(`${prop}="([^"]+)"`));
    if (m && !m[1].startsWith('data:')) return m[1];
  }
  return undefined;
}

export async function fetchLiveBallHomepage(): Promise<string> {
  try {
    return await fetchHtmlWithCurl('https://liveball.sx/');
  } catch {
    // Fallback léger : essai axios au cas où le fingerprint curl change de statut.
    const { data } = await axios.get<string>('https://liveball.sx/', {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      timeout: 15_000,
      responseType: 'text',
    });
    return data;
  }
}

function parseSingleBlock(block: string, status: 'live' | 'upcoming', league?: string): LiveBallMatch | null {
  const href = block.match(/href="\/match\/(\d+)"/) || block.match(/href="\/match\/(\d+)\//);
  if (!href) return null;
  const id = href[1];

  const home = block.match(/team_title team_title_left[\s\S]*?>([\s\S]*?)<\/span>/);
  const away = block.match(/team_title team_title_right[\s\S]*?>([\s\S]*?)<\/span>/);

  const scoreMatch = block.match(/class="score align_center"[^>]*>([\s\S]*?)<\/div>/);
  const tsMatch = block.match(/data-ts="(\d+)"/);

  return {
    id,
    status,
    home: normalizeTeamName(decodeEntities(home?.[1] || '')),
    away: normalizeTeamName(decodeEntities(away?.[1] || '')),
    homeLogo: teamLogo(block, 'left'),
    awayLogo: teamLogo(block, 'right'),
    score: status === 'live' ? (scoreMatch?.[1] ?? '').replace(/\s+/g, ' ').trim() : undefined,
    minute: status === 'live' ? extractMinute(block) : undefined,
    startTs: status === 'upcoming' && tsMatch ? Number(tsMatch[1]) : undefined,
    league,
  };
}

export function parseBlocks(html: string, league?: string): LiveBallMatch[] {
  const matches: LiveBallMatch[] = [];

  const BLOCK_START = '<div class="live_block2">';

  // LiveBall structure ses matchs dans des sections "live_section" (en live)
  // et "time_section" (à venir) sur la homepage, mais sur les pages
  // /league/... tous les matchs sont dans un simple <div class="live">.
  // Pour être robuste on itère tous les blocs et on infère le statut :
  // un bloc live porte un score, un bloc à venir un data-ts.
  const parts = html.split(BLOCK_START);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    if (!block.trim()) continue;
    // L'éventuel prochain bloc qui suit n'apparaît pas ici (split), donc
    // le statut est déduit de la présence du score vs du data-ts.
    const isLive = block.includes('class="score');
    const hasTs = block.includes('data-ts="');
    if (isLive) {
      const parsed = parseSingleBlock(block, 'live', league);
      if (parsed) matches.push(parsed);
    } else if (hasTs) {
      const parsed = parseSingleBlock(block, 'upcoming', league);
      if (parsed) matches.push(parsed);
    }
  }

  // De-duplicate (same match id could appear in both sections momentarily).
  const seen = new Set<string>();
  return matches.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export async function getLiveBallMatches(): Promise<LiveBallMatch[] | null> {
  const cached = CACHE.get('home');
  if (cached) return cached;

  try {
    const html = await fetchLiveBallHomepage();
    const matches = parseBlocks(html);
    if (matches.length > 0) {
      CACHE.set('home', matches);
    }
    return matches;
  } catch {
    return null;
  }
}

export async function getLiveBallLeagueMatches(league: string): Promise<LiveBallMatch[] | null> {
  const normalizedLeague = league.toLowerCase();
  const isUefa = normalizedLeague.includes('champion') || normalizedLeague.includes('uefa');
  const leagueTitle = isUefa ? 'UEFA Champions League' : league;
  
  const slugsToTry = isUefa
    ? ['champions-league', 'uefa-champions-league', 'liga-chempionov']
    : [encodeURIComponent(league)];

  const cacheKey = `league:${slugsToTry[0]}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  let allMatches: LiveBallMatch[] = [];

  for (const slug of slugsToTry) {
    try {
      let html: string;
      try {
        html = await fetchHtmlWithCurl(`https://liveball.sx/league/${slug}`);
      } catch {
        const { data } = await axios.get<string>(`https://liveball.sx/league/${slug}`, {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          },
          timeout: 12_000,
          responseType: 'text',
        });
        html = data;
      }
      const parsed = parseBlocks(html, leagueTitle);
      if (parsed && parsed.length > 0) {
        allMatches.push(...parsed);
        break;
      }
    } catch (_) {}
  }

  // Si c'est la Champions League et qu'on n'a pas assez de matchs, on pioche aussi dans la homepage
  if (isUefa) {
    try {
      const homeMatches = await getLiveBallMatches();
      if (homeMatches) {
        const uefaOnHome = homeMatches.filter(
          (m) =>
            m.league?.toLowerCase().includes('champion') ||
            m.league?.toLowerCase().includes('uefa') ||
            TEAM_NAMES[m.home] !== undefined ||
            TEAM_NAMES[m.away] !== undefined
        );
        allMatches.push(...uefaOnHome.map((m) => ({ ...m, league: 'UEFA Champions League' })));
      }
    } catch (_) {}
  }

  // Dédoublonnage
  const seen = new Set<string>();
  const uniqueMatches = allMatches.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  if (uniqueMatches.length > 0) {
    CACHE.set(cacheKey, uniqueMatches);
  }

  return uniqueMatches;
}

interface StreamResponse {
  d?: string; // base64(m3u8 url) ou base64(url de player sirame)
  m?: string; // "h" = hls, "f" = flash/iframe
  e?: string; // erreur, ex. "invalid_token"
}

// Résout le flux réel d'un match live (HLS ou player iframe).
// Résout le flux réel d'un match live (HLS ou player iframe).
//
// Côté liveball.sx, chaque page de match embarque un token signé soit via
// `window._lbStreams = {"b0": {"t": "..."}, "b1": {"t": "..."}}`, soit via
// `<script>_xrq("...")</script>`. cl.min.js le décode (XOR avec TOKEN_XOR_KEY)
// puis POST `{t, f: '0'}` vers /api/c/r. La réponse contient :
//  - m="h" : une URL m3u8 (base64) du flux réel HLS ;
//  - m="f" : une URL de player à embarquer en iframe (base64).
export async function resolveLiveBallStream(matchId: string, forceRefresh = false): Promise<ResolvedStream | null> {
  if (!forceRefresh) {
    const cached = STREAM_CACHE.get(matchId);
    if (cached) return cached;
  } else {
    STREAM_CACHE.delete(matchId);
  }

  try {
    if (!/^\d+$/.test(matchId)) return null;

    // Fetch page
    let html: string;
    try {
      html = await fetchHtmlWithCurl(`https://liveball.sx/match/${matchId}`);
    } catch (err) {
      console.warn(`[LiveBall] Failed to fetch match page ${matchId}: ${err}`);
      return null;
    }

    // Collect all candidate decoded tokens
    const candidateTokens: string[] = [];

    // 1. FORMAT COURANT : window._lbStreams = {"b0":{"t":"base64token"},"b1":{"t":"base64token"}};
    const streamMatch =
      html.match(/window\._lbStreams\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:window\._lbActiveStream|<\/script>)/) ||
      html.match(/window\._lbStreams\s*=\s*(\{[\s\S]*?\})\s*;/);

    if (streamMatch) {
      try {
        const streams = JSON.parse(streamMatch[1]) as Record<string, { t?: string; msg?: string }>;
        for (const key of Object.keys(streams)) {
          const rawT = streams[key]?.t;
          if (rawT && typeof rawT === 'string') {
            try {
              const decoded = xorDecodeToken(rawT);
              if (decoded && decoded.length > 10) {
                candidateTokens.push(decoded);
              }
            } catch (decErr) {
              console.warn(`[LiveBall] Error XOR-decoding stream ${key} token for match ${matchId}:`, decErr);
            }
          }
        }
      } catch (e) {
        console.warn(`[LiveBall] Failed to parse _lbStreams JSON for match ${matchId}`);
      }
    }

    // 2. FORMAT ALTERNATIF / ANCIEN : _xrq("...")
    const allXrq = html.matchAll(/_xrq\("([^"]+)"\)/g);
    for (const m of allXrq) {
      try {
        const decoded = xorDecodeToken(m[1]);
        if (decoded && !candidateTokens.includes(decoded)) {
          candidateTokens.push(decoded);
        }
      } catch (err) {
        console.warn(`[LiveBall] Failed to decode _xrq token for match ${matchId}:`, err);
      }
    }

    if (candidateTokens.length === 0) {
      console.warn(`[LiveBall] No valid stream token found for match ${matchId}`);
      return null;
    }

    console.log(`[LiveBall] Found ${candidateTokens.length} stream token candidate(s) for match ${matchId}`);

    // Try resolving with each candidate token until one succeeds
    for (const token of candidateTokens) {
      const body = JSON.stringify({ t: token, f: '0' });

      let stdout: string | null = null;

      // Try curl with HTTP/2 and proper headers first
      try {
        const result = await execFileAsync(
          'curl',
          [
            '-sSL',
            '--http2',
            '--compressed',
            '-A', USER_AGENT,
            '-H', 'Accept: application/json, text/plain, */*',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            '-H', 'Accept-Encoding: gzip, deflate, br',
            '-H', 'Content-Type: application/json',
            '-H', `Referer: https://liveball.sx/match/${matchId}`,
            '-H', 'Origin: https://liveball.sx',
            '-H', 'Sec-Fetch-Dest: empty',
            '-H', 'Sec-Fetch-Mode: cors',
            '-H', 'Sec-Fetch-Site: same-origin',
            '-H', 'DNT: 1',
            '-X', 'POST',
            '--data-raw', body,
            '--max-time', '12',
            'https://liveball.sx/api/c/r',
          ],
          { maxBuffer: 2 * 1024 * 1024 }
        );
        stdout = result.stdout;
      } catch (curlErr) {
        // Fallback to axios
        try {
          const { data } = await axios.post<string | StreamResponse>(
            'https://liveball.sx/api/c/r',
            { t: token, f: '0' },
            {
              headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': `https://liveball.sx/match/${matchId}`,
                'Origin': 'https://liveball.sx',
                'DNT': '1',
              },
              timeout: 12_000,
            }
          );
          stdout = typeof data === 'string' ? data : JSON.stringify(data);
        } catch (_) {}
      }

      if (!stdout) continue;

      let parsed: StreamResponse;
      try {
        parsed = JSON.parse(stdout) as StreamResponse;
      } catch {
        continue;
      }

      if (!parsed.d) continue;

      const rawUrl = Buffer.from(parsed.d, 'base64').toString('utf8').trim();
      let url = rawUrl;
      if (url.startsWith('//')) url = `https:${url}`;
      else if (url.startsWith('/')) url = `https://liveball.sx${url}`;

      const type: 'hls' | 'iframe' =
        parsed.m === 'f' || !/\.m3u8($|\?)/i.test(url) ? 'iframe' : 'hls';

      if (type === 'hls' && !/^https?:\/\//.test(url)) continue;
      if (type === 'iframe' && !/^https?:\/\//i.test(url)) continue;

      const stream: ResolvedStream = { url, type };
      STREAM_CACHE.set(matchId, stream);
      console.log(`[LiveBall] ✓ Stream resolved successfully for match ${matchId} (${type}): ${url.slice(0, 80)}...`);
      return stream;
    }

    console.warn(`[LiveBall] All stream candidates failed to resolve for match ${matchId}`);
    return null;
  } catch (err) {
    console.error(`[LiveBall] Unexpected error resolving match ${matchId}:`, err);
    return null;
  }
}

// Cache des matches "en direct" dont le flux a été confirmé disponible.
const AVAILABLE_CACHE = new LRUCache<string, LiveBallMatch[]>({
  max: 10,
  ttl: 10 * 60_000, // 10min
});

// Exécute `fn` sur chaque item avec au plus `limit` promesses concurrentes.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// Ne renvoie que les matchs EN DIRECT dont le flux a pu être résolu.
// La résolution est coûteuse (~2s/match) : on la parallélise (5 à la fois)
// et on cache le résultat 10 min. Les flux sont aussi en STREAM_CACHE (1h).
export async function getLiveBallAvailableMatches(): Promise<LiveBallMatch[] | null> {
  const cached = AVAILABLE_CACHE.get('live');
  if (cached) return cached;

  try {
    const matches = await getLiveBallMatches();
    if (!matches) return null;

    const live = matches.filter((m) => m.status === 'live');
    if (live.length === 0) return [];

    // Increase concurrency from 3 to 5 for faster resolution
    const resolved = await mapLimit(live, 5, async (m) => {
      const stream = await resolveLiveBallStream(m.id);
      return stream ? m : null;
    });

    const available = resolved.filter((m): m is LiveBallMatch => m !== null);
    if (available.length > 0) {
      AVAILABLE_CACHE.set('live', available);
      console.log(`[LiveBall] Available matches: ${available.length}/${live.length}`);
    }
    return available;
  } catch (err) {
    console.error(`[LiveBall] Error resolving available matches:`, err);
    return null;
  }
}