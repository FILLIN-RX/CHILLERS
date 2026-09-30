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

      // 2. Détection directe d'une URL .m3u8 en clair
      const m3u8Match = html.match(/(https?:\/\/[^\s"'<>\\)]+?\.m3u8(?:\?[^\s"'<>\\)]*)?)/i);
      if (m3u8Match && m3u8Match[1]) {
        return {
          m3u8Url: m3u8Match[1],
          referer: currentUrl,
        };
      }

      // 3. Détection de scripts packés (eval(function(p,a,c,k,e,d)...))
      const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\)\)/);
      if (packedMatch) {
        try {
          const unpacked = unpackJs(packedMatch[0]);
          const innerM3u8 = unpacked.match(/(https?:\/\/[^\s"'<>\\)]+?\.m3u8(?:\?[^\s"'<>\\)]*)?)/i);
          if (innerM3u8 && innerM3u8[1]) {
            return {
              m3u8Url: innerM3u8[1],
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
