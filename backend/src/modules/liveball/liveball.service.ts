import cloudscraper from 'cloudscraper';
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

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL;
const LIVEBALL_PROXY = (process.env.LIVEBALL_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '').trim();
export const LIVEBALL_BASE_DOMAINS = [
  process.env.LIVEBALL_DOMAIN || 'liveball.sx',
  'liveball.sx',
  'liveball.to',
  'liveball.net',
  'liveball.org',
  'liveball.im',
];

let webshareProxies: string[] = [];
let lastWebshareFetch = 0;

async function getEffectiveProxy(): Promise<string | undefined> {
  if (LIVEBALL_PROXY) return LIVEBALL_PROXY;
  const apiKey = process.env.WEBSHARE_API_KEY || '7y3c7z8ycmfcrhloc2gwia16m76vuhod4r487muz';
  if (!apiKey) return undefined;
  const now = Date.now();
  if (webshareProxies.length === 0 || now - lastWebshareFetch > 60 * 60 * 1000) {
    try {
      const { data } = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=10', {
        headers: { Authorization: `Token ${apiKey}` },
        timeout: 8000,
      });
      if (data?.results?.length > 0) {
        webshareProxies = data.results.map((p: any) => `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`);
        lastWebshareFetch = now;
        console.log(`[LiveBall] ${webshareProxies.length} proxies Webshare initialisés`);
      }
    } catch (e: any) {
      console.warn('[LiveBall] Échec fetch proxies Webshare:', e.message);
    }
  }
  if (webshareProxies.length === 0) return undefined;
  const idx = Math.floor(Math.random() * webshareProxies.length);
  return webshareProxies[idx];
}

/**
 * Tente de résoudre une requête via une instance FlareSolverr si configurée
 */
async function fetchWithFlareSolverr(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  postData?: Record<string, any>
): Promise<string | null> {
  if (!FLARESOLVERR_URL) return null;
  try {
    const payload: Record<string, any> = {
      cmd: method === 'POST' ? 'request.post' : 'request.get',
      url,
      maxTimeout: 30_000,
    };
    if (method === 'POST' && postData) {
      payload.postData = typeof postData === 'string' ? postData : JSON.stringify(postData);
      payload.headers = { 'Content-Type': 'application/json' };
    }

    const { data } = await axios.post(FLARESOLVERR_URL, payload, { timeout: 35_000 });
    if (data?.status === 'ok' && data.solution?.response) {
      return data.solution.response;
    }
  } catch (err: any) {
    console.warn(`[LiveBall] FlareSolverr request failed for ${url}:`, err?.message || err);
  }
  return null;
}

// Une page HTML n'est exploitable que si elle contient réellement les blocs de
// matches liveball. Cloudflare renvoie des pages 403/Challenge (Turnstile,
// "Attention Required! | Cloudflare", etc.) même en HTTP 200, qui passaient
// les anciens tests "taille > 500 && pas 'Just a moment'" et faisaient
// abandonner la recherche avant d'utiliser le proxy. On rejette donc toute
// page qui ressemble à un blocage Cloudflare.
function isUsableLiveBallHtml(html: string | null | undefined): html is string {
  if (!html) return false;
  const h = html.trim();
  if (h.length < 500) return false;
  const lower = h.toLowerCase();
  const BLOCKED_MARKERS = [
    'just a moment',
    'attention required',
    'challenges.cloudflare.com',
    'cf-chl',
    'cf-turnstile',
    'cf-error-details',
    '/cdn-cgi/challenge',
    'access denied',
    'verify you are human',
    'enable javascript and cookies to continue',
    'grant_fra_2',
    'corporate networks',
    'virtual private network',
    '기상 악화',
  ];
  if (BLOCKED_MARKERS.some((m) => lower.includes(m))) return false;
  if (/<title>\s*(403|error|forbidden|blocked|pardon)[^<]*<\/title>/i.test(h)) return false;
  return true;
}

// Récupération HTML : Direct d'abord (ultra rapide en local/résidentiel), puis Proxy/FlareSolverr en fallback
async function fetchHtmlWithCurl(url: string): Promise<string> {
  // 1. Essai direct avec cloudscraper
  try {
    const csRes = await (cloudscraper as any).get({
      uri: url,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    if (isUsableLiveBallHtml(csRes)) {
      return csRes;
    }
  } catch (_) {}

  // 2. Essai direct avec cURL
  try {
    const curlArgs = [
      '-sSL',
      '--http2',
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
      '--max-time', '15',
      url,
    ];

    const { stdout } = await execFileAsync('curl', curlArgs, { maxBuffer: 4 * 1024 * 1024 });
    if (isUsableLiveBallHtml(stdout)) {
      return stdout;
    }
  } catch (_) {}

  // 3. Fallback via Proxy si disponible
  const proxy = await getEffectiveProxy();
  if (proxy) {
    try {
      const csRes = await (cloudscraper as any).get({
        uri: url,
        headers: { 'User-Agent': USER_AGENT },
        proxy,
      });
      if (typeof csRes === 'string' && csRes.length > 500 && !csRes.includes('Just a moment')) {
        if (isUsableLiveBallHtml(csRes)) return csRes;
      }
    } catch (_) {}
  }

  // 4. FlareSolverr si configuré
  if (FLARESOLVERR_URL) {
    const solverRes = await fetchWithFlareSolverr(url, 'GET');
    if (isUsableLiveBallHtml(solverRes)) {
      return solverRes;
    }
  }

  // 5. Fallback axios
  try {
    const axiosConfig: any = {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 12_000,
      responseType: 'text' as const,
    };
    if (proxy) {
      try {
        const u = new URL(proxy);
        axiosConfig.proxy = {
          protocol: u.protocol.replace(':', ''),
          host: u.hostname,
          port: parseInt(u.port || '80', 10),
          auth: u.username ? { username: u.username, password: u.password } : undefined,
        };
      } catch {}
    }
    const { data } = await axios.get<string>(url, axiosConfig);
    if (isUsableLiveBallHtml(data)) {
      return data;
    }
  } catch (_) {}

  throw new Error(`Unable to bypass Cloudflare for ${url}`);
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
  // Sélections Nationales & Pays (Noms populaires FR/EN)
  'Южная Корея': 'Corée du Sud',
  'Северная Корея': 'Corée du Nord',
  'Нидерланды': 'Pays-Bas',
  'Бельгия': 'Belgique',
  'Китай': 'Chine',
  'Мальдивы': 'Maldives',
  'Намибия': 'Namibie',
  'Конго': 'Congo',
  'ДР Конго': 'RD Congo',
  'Узбекистан': 'Ouzbékistan',
  'Иран': 'Iran',
  'Румыния': 'Roumanie',
  'Венгрия': 'Hongrie',
  'ОАЭ': 'Émirats Arabes Unis',
  'Йемен': 'Yémen',
  'Андорра': 'Andorre',
  'Мальта': 'Malte',
  'Эквадор': 'Équateur',
  'Экваториальная Гвинея': 'Guinée Équatoriale',
  'Ливия': 'Libye',
  'Ботсвана': 'Botswana',
  'Мавритания': 'Mauritanie',
  'ЦАР': 'Centrafrique',
  'Франция': 'France',
  'Испания': 'Espagne',
  'Германия': 'Allemagne',
  'Италия': 'Italie',
  'Англия': 'Angleterre',
  'Португалия': 'Portugal',
  'Бразиlia': 'Brésil',
  'Бразилия': 'Brésil',
  'Аргентина': 'Argentine',
  'Марокко': 'Maroc',
  'Алжир': 'Algérie',
  'Тунис': 'Tunisie',
  'Сенегал': 'Sénégal',
  'Кот-д’Ивуар': "Côte d'Ivoire",
  'Кот-д-Ивуар': "Côte d'Ivoire",
  'Камерун': 'Cameroun',
  'Нигерия': 'Nigéria',
  'Гана': 'Ghana',
  'Египет': 'Égypte',
  'Колумбия': 'Colombie',
  'Уругвай': 'Uruguay',
  'Чили': 'Chili',
  'Перу': 'Pérou',
  'Мексика': 'Mexique',
  'США': 'USA',
  'Канада': 'Canada',
  'Япония': 'Japon',
  'Швейцария': 'Suisse',
  'Швеция': 'Suède',
  'Норвегия': 'Norvège',
  'Дания': 'Danemark',
  'Польша': 'Pologne',
  'Хорватия': 'Croatie',
  'Сербия': 'Serbie',
  'Турция': 'Turquie',
  'Греция': 'Grèce',
  'Австрия': 'Autriche',
  'Чехия': 'Tchéquie',
  'Украина': 'Ukraine',
  'Уэльс': 'Pays de Galles',
  'Шотландия': 'Écosse',

  // UEFA Champions League & Grands Clubs
  'АЕК Афины': 'AEK Athènes',
  'Ласк': 'LASK',
  'Брюгге': 'Club Bruges',
  'Астон Вилла': 'Aston Villa',
  'Боруссия Д': 'Borussia Dortmund',
  'Боруссия Дортмунд': 'Borussia Dortmund',
  'Вильярреал': 'Villarreal',
  'Порту': 'FC Porto',
  'Манчестер Сити': 'Manchester City',
  'Лилль': 'Lille OSC',
  'Реал Бетис': 'Real Betis',
  'Реал Мадрид': 'Real Madrid',
  'Интер': 'Inter Milan',
  'Барселона': 'FC Barcelone',
  'Фейеноорд': 'Feyenoord',
  'Штутгарт': 'VfB Stuttgart',
  'Викинг': 'Viking',
  'Ливерпуль': 'Liverpool',
  'Атлетико Мадрид': 'Atlético de Madrid',
  'Атлетико': 'Atlético de Madrid',
  'Наполи': 'Napoli',
  'Арсенал': 'Arsenal',
  'ПСЖ': 'Paris Saint-Germain',
  'Слован': 'Slovan Bratislava',
  'Спортинг': 'Sporting CP',
  'Галатасарай': 'Galatasaray',
  'Фенербахче': 'Fenerbahçe',
  'Рома': 'AS Roma',
  'ПСВ': 'PSV Eindhoven',
  'Шахтер': 'Shakhtar Donetsk',
  'Бавария': 'Bayern Munich',
  'Будё-Глимт': 'Bodø/Glimt',
  'Кальчо Комо': 'Como',
  'РБ Лейпциг': 'RB Leipzig',
  'Манчестер Юнайтед': 'Manchester United',
  'Сабах': 'Sabah',
  'Славия Прага': 'Slavia Prague',
  'Ланс': 'RC Lens',
  'Марсель': 'Olympique de Marseille',
  'Лион': 'Olympique Lyonnais',
  'Ницца': 'OGC Nice',
  'Ренн': 'Stade Rennais',
  'Монако': 'AS Monaco',
  'Ювентус': 'Juventus',
  'Милан': 'AC Milan',
  'Лацио': 'Lazio Rome',
  'Аталанта': 'Atalanta Bergame',
  'Фиорентина': 'Fiorentina',
  'Тоттенхэм': 'Tottenham Hotspur',
  'Челси': 'Chelsea FC',
  'Эвертон': 'Everton',
  'Ньюкасл': 'Newcastle United',
  'Вест Хэм': 'West Ham',
  'Аякс': 'Ajax Amsterdam',
  'АЗ Алкмар': 'AZ Alkmaar',
  'Твенте': 'Twente',
  'Реал Сосьедад': 'Real Sociedad',
  'Севилья': 'FC Séville',
  'Валенсия': 'Valence CF',
  'Атлетик Бильбао': 'Athletic Bilbao',
  'Бенфика': 'Benfica Lisbonne',
  'Байер': 'Bayer Leverkusen',
  'Боруссия М': 'Borussia Mönchengladbach',
  'Вольфсбург': 'VfL Wolfsburg',
  'Франкфурт': 'Eintracht Francfort',
  'Бешикташ': 'Beşiktaş',
  'Трабзонспор': 'Trabzonspor',
  'Базель': 'FC Bâle',
  'Янг Бойз': 'Young Boys',
  'Црвена Звезда': 'Étoile Rouge de Belgrade',
  'Партизан': 'Partizan Belgrade',
  'Рейнджерс': 'Rangers FC',
  'Селтик': 'Celtic Glasgow',
  'Гент': 'La Gantoise',
  'Андерлехт': 'Anderlecht',
  'Динамо Киев': 'Dynamo Kiev',
  'Динамо Загреб': 'Dinamo Zagreb',
  'Зенит': 'Zénith Saint-Pétersbourg',
  'ЦСКА': 'CSKA Moscou',
  'Спартак Москва': 'Spartak Moscou',
  'Локомотив Москва': 'Lokomotiv Moscou',
  'Краснодар': 'FC Krasnodar',
  'Ростов': 'FK Rostov',

  // Clubs saoudiens & Moyen-Orient
  'Аль-Иттифак': 'Al-Ettifaq',
  'Аль-Фейсали': 'Al-Faisaly',
  'Аль-Хазм': 'Al-Hazem',
  'Аль-Таавун': 'Al-Taawoun',
  'Аль-Хиляль': 'Al-Hilal',
  'Аль-Наср': 'Al-Nassr',
  'Аль-Иттихад': 'Al-Ittihad',
  'Аль-Ахли': 'Al-Ahli',

  // Clubs israéliens (Хапоэль / Маккаби)
  'Хапоэль Акко': 'Hapoel Acre',
  'Хапоэль Афула': 'Hapoel Afula',
  'Хапоэль Ришон-ле-Цион': 'Hapoel Rishon LeZion',
  'Маккаби Ахи Назарет': 'Maccabi Ahi Nazareth',
  'Маккаби Тель-Авив': 'Maccabi Tel-Aviv',
  'Маккаби Хайфа': 'Maccabi Haïfa',
  'Хапоэль Тель-Авив': 'Hapoel Tel-Aviv',
  'Хапоэль Беэр-Шева': 'Hapoel Beer-Sheva',
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

// Traduit les noms d'équipes russes vers leurs noms populaires et officiels
function normalizeTeamName(name: string): string {
  const trimmed = name.trim();
  if (TEAM_NAMES[trimmed]) return TEAM_NAMES[trimmed];

  const uMatch = trimmed.match(/\s*\((U-?\d+)\)/i);
  const isWomen = trimmed.includes('(жен)') || trimmed.toLowerCase().includes('(women)');
  const isU21 = trimmed.includes('(мол)');

  const baseName = trimmed
    .replace(/\s*\((U-?\d+)\)/gi, '')
    .replace(/\s*\(жен\)/gi, '')
    .replace(/\s*\(мол\)/gi, '')
    .replace(/\s*\(Women\)/gi, '')
    .trim();

  let translatedBase = TEAM_NAMES[baseName];
  if (!translatedBase) {
    const translit = transliterate(baseName);
    translatedBase = translit.replace(/(^|\s|-)([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }

  let suffix = '';
  if (uMatch) suffix += ` (${uMatch[1].toUpperCase()})`;
  if (isU21) suffix += ' (U-21)';
  if (isWomen) suffix += ' (Féminin)';

  return `${translatedBase}${suffix}`.trim();
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
  const proxy = await getEffectiveProxy();
  for (const domain of LIVEBALL_BASE_DOMAINS) {
    try {
      const html = await fetchHtmlWithCurl(`https://${domain}/`);
      if (isUsableLiveBallHtml(html) && (html.includes('live_block2') || html.includes('live_section'))) {
        return html;
      }
    } catch {
      try {
        const axiosConfig: any = {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          },
          timeout: 12_000,
          responseType: 'text' as const,
        };
        if (proxy) {
          try {
            const u = new URL(proxy);
            axiosConfig.proxy = {
              protocol: u.protocol.replace(':', ''),
              host: u.hostname,
              port: parseInt(u.port || '80', 10),
              auth: u.username ? { username: u.username, password: u.password } : undefined,
            };
          } catch {}
        }
        const { data } = await axios.get<string>(`https://${domain}/`, axiosConfig);
        if (isUsableLiveBallHtml(data) && (data.includes('live_block2') || data.includes('live_section'))) {
          return data;
        }
      } catch {}
    }
  }
  throw new Error('All LiveBall domains failed to respond');
}

function parseSingleBlock(block: string, status: 'live' | 'upcoming', league?: string): LiveBallMatch | null {
  const href = block.match(/href="\/match\/(\d+)"/) || block.match(/href="\/match\/(\d+)\//);
  if (!href) return null;
  const id = href[1];

  const home = block.match(/team_title team_title_left[\s\S]*?>([\s\S]*?)<\/span>/);
  const away = block.match(/team_title team_title_right[\s\S]*?>([\s\S]*?)<\/span>/);

  const scoreMatch = block.match(/class="score align_center"[^>]*>([\s\S]*?)<\/div>/);
  const tsMatch = block.match(/data-ts="(\d+)"/);
  const startTs = tsMatch ? Number(tsMatch[1]) : undefined;
  const nowSec = Math.floor(Date.now() / 1000);

  // Si le match est marqué upcoming mais a commencé il y a plus de 3h30, il est déjà passé
  if (status === 'upcoming' && startTs && startTs < nowSec - 3.5 * 3600) {
    return null;
  }

  return {
    id,
    status,
    home: normalizeTeamName(decodeEntities(home?.[1] || '')),
    away: normalizeTeamName(decodeEntities(away?.[1] || '')),
    homeLogo: teamLogo(block, 'left'),
    awayLogo: teamLogo(block, 'right'),
    score: status === 'live' ? (scoreMatch?.[1] ?? '').replace(/\s+/g, ' ').trim() : undefined,
    minute: status === 'live' ? extractMinute(block) : undefined,
    startTs: status === 'upcoming' ? startTs : undefined,
    league,
  };
}

export function parseBlocks(html: string, league?: string): LiveBallMatch[] {
  const matches: LiveBallMatch[] = [];

  const BLOCK_START = '<div class="live_block2">';
  const hasLiveSection = html.includes('class="live_section"');
  const nowSec = Math.floor(Date.now() / 1000);

  const parts = html.split(BLOCK_START);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    if (!block.trim()) continue;

    const isLive = block.includes('class="score');
    const hasTs = block.includes('data-ts="');
    const tsMatch = block.match(/data-ts="(\d+)"/);
    const startTs = tsMatch ? Number(tsMatch[1]) : undefined;
    const hasMinute = !!extractMinute(block);

    // Sur une page de ligue (/league/...) ou archives, les matchs terminés ont un score final mais AUCUNE minute de jeu en direct.
    // Un match n'est réellement "live" que s'il est dans la live_section OU s'il porte une minute de jeu active (ex: 45', 78').
    if (isLive) {
      if (!hasLiveSection && !hasMinute) {
        // Match terminé/archivé de la compétition -> on l'exclut totalement
        continue;
      }
      const parsed = parseSingleBlock(block, 'live', league);
      if (parsed) matches.push(parsed);
    } else if (hasTs) {
      if (startTs && startTs < nowSec - 15 * 60) {
        // Heure de match déjà dépassée
        continue;
      }
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

const LEAGUE_CONFIGS: Record<string, { title: string; slugs: string[]; keywords: string[]; teams: string[] }> = {
  'champions-league': {
    title: 'UEFA Champions League',
    slugs: ['champions-league', 'uefa-champions-league', 'liga-chempionov'],
    keywords: ['champion', 'uefa', 'лига чемпионов'],
    teams: ['Real Madrid', 'Manchester City', 'Bayern Munich', 'PSG', 'Paris Saint-Germain', 'Arsenal', 'Barcelona', 'Inter', 'Liverpool', 'Atletico Madrid', 'Borussia Dortmund', 'Juventus', 'Bayer Leverkusen', 'Atalanta', 'Milan', 'Sporting CP', 'Benfica', 'Monaco', 'Lille', 'Aston Villa', 'PSV', 'Feyenoord', 'Celtic', 'Club Brugge', 'Red Star Belgrade', 'Young Boys', 'Sturm Graz', 'Brest', 'Salzburg', 'Sparta Prague', 'Bologna', 'Girona', 'Stuttgart', 'Leipzig', 'Shakhtar', 'Dinamo Zagreb', 'Slovan Bratislava'],
  },
  'uefa-champions-league': {
    title: 'UEFA Champions League',
    slugs: ['champions-league', 'uefa-champions-league', 'liga-chempionov'],
    keywords: ['champion', 'uefa', 'лига чемпионов'],
    teams: [],
  },
  'premier-league': {
    title: 'Premier League',
    slugs: ['premier-league', 'epl', 'angliya-premer-liga', 'apl', 'england-premier-league'],
    keywords: ['premier', 'epl', 'england', 'премьер-лига', 'апл', 'англия'],
    teams: ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham', 'Aston Villa', 'Newcastle', 'Everton', 'Brighton', 'Brayton', 'West Ham', 'Wolverhampton', 'Wolves', 'Fulham', 'Fulkhem', 'Crystal Palace', 'Kristal Pelas', 'Brentford', 'Bournemouth', 'Bornmut', 'Nottingham Forest', 'Nottingem Forest', 'Leicester', 'Lester', 'Southampton', 'Ipswich Town', 'Ipsvich Taun', 'Leeds', 'Lids Yunayted', 'Sunderland', 'Sanderlend', 'Hull City', 'Khall Siti', 'Coventry', 'Koventri Siti'],
  },
  'epl': {
    title: 'Premier League',
    slugs: ['epl', 'premier-league', 'angliya-premer-liga', 'apl'],
    keywords: ['premier', 'epl', 'england', 'премьер-лига', 'апл', 'англия'],
    teams: [],
  },
  'la-liga': {
    title: 'La Liga',
    slugs: ['la-liga', 'primera', 'ispaniya-primera', 'spain-la-liga', 'laliga'],
    keywords: ['liga', 'spain', 'primera', 'ла лига', 'примера', 'испания'],
    teams: ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Atletiko Madrid', 'Sevilla', 'Real Sociedad', 'Villarreal', 'Athletic Bilbao', 'Atletik', 'Real Betis', 'Valencia', 'Valensiya', 'Girona', 'Celta', 'Selta', 'Osasuna', 'Mallorca', 'Malorka', 'Las Palmas', 'Alaves', 'Rayo Vallecano', 'Rayo Valekano', 'Getafe', 'Khetafe', 'Espanyol', 'Valladolid', 'Valyadolid', 'Leganes', 'Racing', 'Rasing', 'Levante', 'Malaga'],
  },
  'serie-a': {
    title: 'Serie A',
    slugs: ['seria-a', 'serie-a', 'seriya-a', 'italiya-seriya-a', 'italy-serie-a'],
    keywords: ['serie a', 'seria a', 'italy', 'italia', 'серия а', 'италия'],
    teams: ['Juventus', 'Yuventus', 'Inter', 'AC Milan', 'Milan', 'Napoli', 'Roma', 'Lazio', 'Latsio', 'Atalanta', 'Fiorentina', 'Torino', 'Bologna', 'Bolonya', 'Monza', 'Montsa', 'Genoa', 'Dzhenoa', 'Udinese', 'Udineze', 'Verona', 'Cagliari', 'Kalyari', 'Empoli', 'Parma', 'Como', 'Komo', 'Venezia', 'Venetsiya', 'Lecce', 'Lechche'],
  },
  'seria-a': {
    title: 'Serie A',
    slugs: ['seria-a', 'serie-a', 'seriya-a', 'italiya-seriya-a', 'italy-serie-a'],
    keywords: ['serie a', 'seria a', 'italy', 'italia', 'серия а', 'италия'],
    teams: [],
  },
  'bundesliga': {
    title: 'Bundesliga',
    slugs: ['bundesliga', 'germaniya-bundesliga', 'germany-bundesliga'],
    keywords: ['bundesliga', 'germany', 'бундеслига', 'германия'],
    teams: ['Bayern Munich', 'Bavariya', 'Borussia Dortmund', 'Borussiya D', 'Bayer Leverkusen', 'Bayer', 'RB Leipzig', 'Leyptsig', 'Eintracht Frankfurt', 'Ayntrakht', 'Stuttgart', 'Shtutgart', 'Wolfsburg', 'Volfsburg', 'Borussia Monchengladbach', 'Borussiya M', 'Freiburg', 'Frayburg', 'Hoffenheim', 'Khoffenkhaym', 'Augsburg', 'Union Berlin', 'Werder Bremen', 'Verder', 'Mainz', 'Maynts', 'Heidenheim', 'Khaydenkhaym', 'St. Pauli', 'Sankt-Pauli', 'Holstein Kiel', 'Kholstayn Kil', 'Bochum', 'Bokhum'],
  },
  'ligue-1': {
    title: 'Ligue 1',
    slugs: ['ligue-1', 'frantsiya-liga-1', 'france-ligue-1', 'liga-1'],
    keywords: ['ligue 1', 'france', 'лига 1', 'франция'],
    teams: ['Paris Saint-Germain', 'PSG', 'Marseille', 'Marsel', 'Lyon', 'Lion', 'Monaco', 'Monako', 'Lille', 'Lill', 'Rennes', 'Renn', 'Nice', 'Nitstsa', 'Lens', 'Lans', 'Strasbourg', 'Strasbur', 'Nantes', 'Nant', 'Brest', 'Reims', 'Reyms', 'Montpellier', 'Monpele', 'Toulouse', 'Tuluza', 'Auxerre', 'Oser', 'Angers', 'Anzhe', 'Saint-Etienne', 'Sent-Eten', 'Le Havre', 'Gavr'],
  },
};

export async function getLiveBallLeagueMatches(league: string): Promise<LiveBallMatch[] | null> {
  const normalizedInput = league.toLowerCase().trim().replace(/[\s_]+/g, '-');
  const matchedKey = Object.keys(LEAGUE_CONFIGS).find(
    (k) =>
      k === normalizedInput ||
      normalizedInput.includes(k) ||
      k.includes(normalizedInput)
  );

  const conf = matchedKey ? LEAGUE_CONFIGS[matchedKey] : null;
  const leagueTitle = conf ? conf.title : league;
  const slugsToTry = conf ? conf.slugs : [encodeURIComponent(league)];

  const cacheKey = `league:${slugsToTry[0]}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  let allMatches: LiveBallMatch[] = [];

  for (const slug of slugsToTry) {
    let found = false;
    for (const domain of LIVEBALL_BASE_DOMAINS) {
      try {
        let html: string;
        try {
          html = await fetchHtmlWithCurl(`https://${domain}/league/${slug}`);
        } catch {
          const { data } = await axios.get<string>(`https://${domain}/league/${slug}`, {
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
          found = true;
          break;
        }
      } catch (_) {}
    }
    if (found) break;
  }

  // Mettre à jour avec les informations en direct (score, minute, live) depuis la page d'accueil
  try {
    const homeMatches = await getLiveBallMatches();
    if (homeMatches && homeMatches.length > 0) {
      const homeMap = new Map<string, LiveBallMatch>();
      for (const hm of homeMatches) {
        if (hm?.id) homeMap.set(hm.id, hm);
      }

      // 1. Si un match officiel de la ligue est actuellement en direct sur la page d'accueil, synchroniser son statut live et score
      allMatches = allMatches.map((m) => {
        const liveMatch = homeMap.get(m.id);
        if (liveMatch && liveMatch.status === 'live') {
          return {
            ...m,
            status: 'live',
            score: liveMatch.score || m.score,
            minute: liveMatch.minute || m.minute,
          };
        }
        return m;
      });

      // 2. Si un match en direct sur la page d'accueil a les DEUX équipes qui appartiennent strictement à ce championnat
      if (conf && conf.teams.length > 0) {
        const teamsLower = conf.teams.map((t) => t.toLowerCase().trim());
        const matchIds = new Set(allMatches.map((m) => m.id));

        for (const hm of homeMatches) {
          if (hm.status === 'live' && !matchIds.has(hm.id)) {
            const h = (hm.home || '').toLowerCase().trim();
            const a = (hm.away || '').toLowerCase().trim();
            // Les DEUX équipes doivent obligatoirement appartenir au championnat (pas de match amical / coupe internationale mixte)
            const homeIsLeagueTeam = teamsLower.some((t) => h === t || (h.length > 3 && t.length > 3 && (h.startsWith(t) || t.startsWith(h))));
            const awayIsLeagueTeam = teamsLower.some((t) => a === t || (a.length > 3 && t.length > 3 && (a.startsWith(t) || t.startsWith(a))));

            if (homeIsLeagueTeam && awayIsLeagueTeam) {
              allMatches.unshift({ ...hm, league: leagueTitle });
              matchIds.add(hm.id);
            }
          }
        }
      }
    }
  } catch (_) {}

  // Dédoublonnage et tri : d'abord les matchs LIVE, puis upcoming
  const nowSec = Math.floor(Date.now() / 1000);
  const seen = new Set<string>();
  const uniqueMatches: LiveBallMatch[] = [];

  for (const m of allMatches) {
    if (!m || !m.id || seen.has(m.id)) continue;
    if (m.status === 'upcoming' && m.startTs && m.startTs < nowSec - 3.5 * 3600) {
      continue; // Ne pas inclure de matchs passés
    }
    seen.add(m.id);
    uniqueMatches.push(m);
  }

  // Trier : matchs en DIRECT en premier, puis les matchs à venir ordonnés par heure
  uniqueMatches.sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (a.status !== 'live' && b.status === 'live') return 1;
    return (a.startTs || 0) - (b.startTs || 0);
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
//
// Chaque page de match embarque un token signé soit via
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

    // Fetch page across active domains
    let html: string | null = null;
    let activeDomain = 'liveball.to';
    for (const domain of LIVEBALL_BASE_DOMAINS) {
      try {
        html = await fetchHtmlWithCurl(`https://${domain}/match/${matchId}`);
        if (html && (html.includes('_lbStreams') || html.includes('_xrq') || html.length > 1000)) {
          activeDomain = domain;
          break;
        }
      } catch {
        try {
          const { data } = await axios.get<string>(`https://${domain}/match/${matchId}`, {
            headers: {
              'User-Agent': USER_AGENT,
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 12_000,
            responseType: 'text',
          });
          if (data && (data.includes('_lbStreams') || data.includes('_xrq') || data.length > 1000)) {
            html = data;
            activeDomain = domain;
            break;
          }
        } catch (_) {}
      }
    }

    if (!html) {
      console.warn(`[LiveBall] Failed to fetch match page ${matchId} from all domains`);
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
        const streams = JSON.parse(streamMatch[1]) as Record<string, any>;
        for (const key of Object.keys(streams)) {
          const item = streams[key];
          if (!item) continue;

          // Direct URL / Player embed inside _lbStreams
          const directUrl = item.u || item.p || item.src || item.url || item.stream;
          if (directUrl && typeof directUrl === 'string' && directUrl.length > 5) {
            let u = directUrl.trim();
            if (u.startsWith('//')) u = `https:${u}`;
            else if (u.startsWith('/')) u = `https://${activeDomain}${u}`;
            const type = /\.m3u8($|\?)/i.test(u) ? 'hls' : 'iframe';
            const stream: ResolvedStream = { url: u, type };
            STREAM_CACHE.set(matchId, stream);
            console.log(`[LiveBall] ✓ Direct stream found in _lbStreams for match ${matchId} (${type}): ${u}`);
            return stream;
          }

          const rawT = item.t;
          if (rawT && typeof rawT === 'string') {
            try {
              const decoded = xorDecodeToken(rawT);
              if (decoded && decoded.length > 5 && !candidateTokens.includes(decoded)) {
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

    console.log(`[LiveBall] Found ${candidateTokens.length} stream token candidate(s) for match ${matchId}`);
    const proxy = await getEffectiveProxy();

    // Try resolving with candidate tokens
    for (const token of candidateTokens) {
      for (const formatFlag of ['0', '1']) {
        const body = JSON.stringify({ t: token, f: formatFlag });
        let stdout: string | null = null;

        // 1. Cloudscraper direct (sans proxy d'abord)
        try {
          const csData = await (cloudscraper as any).post({
            uri: `https://${activeDomain}/api/c/r`,
            body: { t: token, f: formatFlag },
            json: true,
            headers: {
              Referer: `https://${activeDomain}/match/${matchId}`,
              Origin: `https://${activeDomain}`,
              'User-Agent': USER_AGENT,
            },
          });
          if (csData) {
            stdout = typeof csData === 'string' ? csData : JSON.stringify(csData);
          }
        } catch (_) {}

        // 2. cURL direct
        if (!stdout) {
          try {
            const curlArgs = [
              '-sSL',
              '--http2',
              '--compressed',
              '-A', USER_AGENT,
              '-H', 'Accept: application/json, text/plain, */*',
              '-H', 'Accept-Language: en-US,en;q=0.9',
              '-H', 'Content-Type: application/json',
              '-H', `Referer: https://${activeDomain}/match/${matchId}`,
              '-H', `Origin: https://${activeDomain}`,
              '-H', 'Sec-Fetch-Dest: empty',
              '-H', 'Sec-Fetch-Mode: cors',
              '-H', 'Sec-Fetch-Site: same-origin',
              '-X', 'POST',
              '--data-raw', body,
              '--max-time', '10',
              `https://${activeDomain}/api/c/r`,
            ];
            const result = await execFileAsync('curl', curlArgs, { maxBuffer: 2 * 1024 * 1024 });
            if (result.stdout && result.stdout.includes('{')) {
              stdout = result.stdout;
            }
          } catch (_) {}
        }

        // 3. FlareSolverr si configuré
        if (!stdout && FLARESOLVERR_URL) {
          stdout = await fetchWithFlareSolverr(`https://${activeDomain}/api/c/r`, 'POST', { t: token, f: formatFlag });
        }

        // 4. Fallback avec proxy si direct n'a pas répondu
        if (!stdout && proxy) {
          try {
            const csData = await (cloudscraper as any).post({
              uri: `https://${activeDomain}/api/c/r`,
              body: { t: token, f: formatFlag },
              json: true,
              headers: {
                Referer: `https://${activeDomain}/match/${matchId}`,
                Origin: `https://${activeDomain}`,
                'User-Agent': USER_AGENT,
              },
              proxy,
            });
            if (csData) {
              stdout = typeof csData === 'string' ? csData : JSON.stringify(csData);
            }
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
        else if (url.startsWith('/')) url = `https://${activeDomain}${url}`;

        const type: 'hls' | 'iframe' =
          parsed.m === 'f' || !/\.m3u8($|\?)/i.test(url) ? 'iframe' : 'hls';

        if (type === 'hls' && !/^https?:\/\//.test(url)) continue;
        if (type === 'iframe' && !/^https?:\/\//i.test(url)) continue;

        const stream: ResolvedStream = { url, type };
        STREAM_CACHE.set(matchId, stream);
        console.log(`[LiveBall] ✓ Stream resolved successfully for match ${matchId} (${type}): ${url.slice(0, 80)}...`);
        return stream;
      }
    }

    // 3. ULTIMATE FALLBACK: inspect HTML for embedded iframe or direct stream URLs
    const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeMatch && iframeMatch[1] && !iframeMatch[1].includes('about:blank')) {
      let u = iframeMatch[1].trim();
      if (u.startsWith('//')) u = `https:${u}`;
      const stream: ResolvedStream = { url: u, type: 'iframe' };
      STREAM_CACHE.set(matchId, stream);
      console.log(`[LiveBall] ✓ Fallback iframe stream found for match ${matchId}: ${u}`);
      return stream;
    }

    const regexStreamMatch = html.match(/(https?:\/\/[^"'\s<>]*(?:nhr|hayuhi|player|stream|live|m3u8)[^"'\s<>]*)/i);
    if (regexStreamMatch && regexStreamMatch[1]) {
      const u = regexStreamMatch[1].trim();
      const type = /\.m3u8($|\?)/i.test(u) ? 'hls' : 'iframe';
      const stream: ResolvedStream = { url: u, type };
      STREAM_CACHE.set(matchId, stream);
      console.log(`[LiveBall] ✓ Fallback regex stream found for match ${matchId} (${type}): ${u}`);
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