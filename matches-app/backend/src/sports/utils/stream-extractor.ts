import axios from 'axios';
import vm from 'vm';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface ExtractedStream {
  m3u8Url: string;
  referer?: string;
  headers?: Record<string, string>;
}

/**
 * Une URL .m3u8 dans une page de lecteur est tantôt absolue, tantôt
 * protocole-relative (`//host/x.m3u8`), tantôt un chemin relatif — les trois
 * formes apparaissent chez les mêmes hébergeurs (azplay, apl627…).
 */
function findM3u8Url(html: string, baseUrl: string): string | null {
  const absolute = html.match(/(?:https?:)?\/\/[^\s"'<>\\)]+?\.m3u8(?:\?[^\s"'<>\\)]*)?/i);
  if (absolute?.[0]) {
    const raw = absolute[0];
    return raw.startsWith('//') ? `https:${raw}` : raw;
  }
  const relative = html.match(/["'(]\/(?!\/)[^\s"'<>\\)]+?\.m3u8(?:\?[^\s"'<>\\)]*)?/i);
  if (relative?.[0]) {
    try {
      return new URL(relative[0].slice(1), baseUrl).toString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Décode la configuration chiffrée _econfig des lecteurs Dynproclaim / Xstream
 */
export function decodeDynproclaimConfig(rawB64: string): Record<string, any> | null {
  try {
    if (!rawB64) return null;
    const order = [2, 0, 3, 1];
    const parts = 4;
    const decoded1 = Buffer.from(rawB64, 'base64').toString('binary');
    const partLen = Math.floor(decoded1.length / parts);
    const chunks: string[] = [];
    let offset = 0;
    for (let i = 0; i < parts; i++) {
      chunks.push(decoded1.substr(offset, partLen));
      offset += partLen;
    }
    const orderedChunks: string[] = [];
    for (let i = 0; i < order.length; i++) {
      let chunk = String(chunks[i]);
      chunk = chunk.slice(0, 3) + chunk.slice(4);
      orderedChunks[order[i]] = Buffer.from(chunk, 'base64').toString('binary');
    }
    const joined = orderedChunks.join('');
    const finalDecoded = Buffer.from(joined, 'base64').toString('utf8');
    return JSON.parse(finalDecoded);
  } catch (err: any) {
    console.warn('[StreamExtractor] Échec déchiffrement _econfig:', err?.message);
    return null;
  }
}

/**
 * Tente d'extraire récursivement le flux HLS (.m3u8) direct à partir d'une URL de lecteur/iframe
 */
export async function extractDirectStream(initialUrl: string, initialReferer?: string): Promise<ExtractedStream | null> {
  let currentUrl = initialUrl;
  let referer = initialReferer || new URL(initialUrl).origin;
  const visited = new Set<string>();

  for (let depth = 0; depth < 5; depth++) {
    if (visited.has(currentUrl)) break;
    visited.add(currentUrl);

    try {
      const response = await axios.get<string>(currentUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: referer,
          Origin: new URL(referer).origin,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'iframe',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
        },
        timeout: 10_000,
        responseType: 'text',
        maxRedirects: 5,
      });

      const html = response.data;
      if (!html || typeof html !== 'string') return null;

      // 1. Détection et déchiffrement de _econfig (Dynproclaim / Xstream / Kora)
      const econfigMatch = html.match(/_econfig\s*=\s*['"]([^'"]+)['"]/);
      if (econfigMatch && econfigMatch[1]) {
        const config = decodeDynproclaimConfig(econfigMatch[1]);
        if (config) {
          const rawStreamUrl = config.stream_url || config.stream_url_nop2p || config.url_nop2p || config.source;
          if (rawStreamUrl && typeof rawStreamUrl === 'string' && /\.m3u8/i.test(rawStreamUrl)) {
            console.log(`[StreamExtractor] ✓ Flux HLS extrait depuis _econfig: ${rawStreamUrl.slice(0, 70)}...`);
            return {
              m3u8Url: rawStreamUrl,
              referer: currentUrl,
            };
          }
        }
      }

      // 1b. Détection token Clappr/Kora base64 url-safe (urlSafeBase64Decode(CONFIG.token) ou CONFIG = { token: '...' })
      const koraTokenMatch =
        html.match(/CONFIG\s*=\s*\{[\s\S]*?token\s*:\s*['"]([A-Za-z0-9_-]+)['"]/i) ||
        html.match(/urlSafeBase64Decode\s*\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/i);
      if (koraTokenMatch && koraTokenMatch[1]) {
        try {
          let b64 = koraTokenMatch[1].replace(/-/g, '+').replace(/_/g, '/');
          const pad = b64.length % 4;
          if (pad) b64 += '='.repeat(4 - pad);
          const decodedUrl = Buffer.from(b64, 'base64').toString('utf8');
          if (decodedUrl && /\.m3u8/i.test(decodedUrl)) {
            console.log(`[StreamExtractor] ✓ Flux HLS extrait depuis CONFIG.token (Kora): ${decodedUrl.slice(0, 70)}...`);
            return {
              m3u8Url: decodedUrl,
              referer: currentUrl,
            };
          }
        } catch {}
      }

      // 2. Détection directe d'une URL .m3u8 en clair (absolue, protocole-relative ou relative)
      const m3u8Url = findM3u8Url(html, currentUrl);
      if (m3u8Url) {
        return {
          m3u8Url,
          referer: currentUrl,
        };
      }

      // 3. Détection de scripts packés (eval(function(p,a,c,k,e,d)...))
      const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\)\)/);
      if (packedMatch) {
        try {
          const unpacked = unpackJs(packedMatch[0]);
          const innerM3u8 = findM3u8Url(unpacked, currentUrl);
          if (innerM3u8) {
            return {
              m3u8Url: innerM3u8,
              referer: currentUrl,
            };
          }
        } catch {}
      }

      // 4. Détection de sous-iframe
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframeMatch && iframeMatch[1] && !iframeMatch[1].startsWith('about:blank')) {
        let nextUrl = iframeMatch[1].trim();
        if (nextUrl.startsWith('//')) nextUrl = `https:${nextUrl}`;
        else if (nextUrl.startsWith('/')) nextUrl = new URL(nextUrl, currentUrl).toString();

        referer = currentUrl;
        currentUrl = nextUrl;
        continue;
      }

      break;
    } catch (err: any) {
      console.warn(`[StreamExtractor] Erreur sur ${currentUrl}:`, err?.message);
      break;
    }
  }

  return null;
}

/**
 * Décompresse un script packé avec Dean Edwards Packer (eval(function(p,a,c,k,e,d)...))
 */
function unpackJs(packedCode: string): string {
  try {
    const sandbox = { evalResult: '' };
    const context = vm.createContext(sandbox);
    const code = packedCode.replace(/^eval\(/, 'evalResult = (');
    vm.runInContext(code, context, { timeout: 1000 });
    return String(sandbox.evalResult || '');
  } catch {
    return '';
  }
}
