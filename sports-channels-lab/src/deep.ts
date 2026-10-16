/**
 * deep.ts — vérification RÉELLE de jouabilité (au-delà du « ça répond »).
 *
 * hls    : télécharge la playlist, résout le 1er segment (ou la variante de
 *          master playlist) et vérifie que le segment délivre de la vidéo
 *          (sync-byte TS 0x47, boîtes fMP4 ftyp/styp/moof, ou playlist).
 * iframe : télécharge la page du player, extrait les .m3u8 embarqués et les
 *          sonde — si le flux est chargé en JS pur, on note « page seule ».
 *
 * Résultat stocké dans `record.deep` :
 *   segmentOk (hls) / extractedM3u8+extractedOk (iframe) / error
 *
 * Usage : tsx src/deep.ts [--concurrency=6] [--limit=50]
 */
import { loadAll, saveAll, type ChannelRecord } from './record';
import { extractDirectStream } from '../../backend/src/modules/sports/utils/stream-extractor';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface DeepResult {
  at: string;
  /** hls : le 1er segment délivre réellement de la vidéo. */
  segmentOk?: boolean;
  segmentType?: string;
  /** iframe : m3u8 extrait de la page, sondé. */
  extractedM3u8?: string;
  extractedOk?: boolean;
  httpStatus?: number;
  error?: string;
}

const args = process.argv.slice(2);
const flag = (name: string, def?: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const CONCURRENCY = Number(flag('concurrency', '6')) || 6;
const LIMIT = Number(flag('limit', '0')) || 0;

async function fetchBytes(
  url: string,
  headers: Record<string, string>,
  maxBytes: number
): Promise<{ status: number; ctype: string; bytes: Uint8Array }> {
  let res = await fetch(url, {
    headers: { ...headers, Range: `bytes=0-${maxBytes - 1}` },
    signal: AbortSignal.timeout(9_000),
    redirect: 'follow',
  });
  if (res.status === 416) {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(9_000), redirect: 'follow' });
  }
  const reader = res.body?.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        parts.push(value);
        total += value.length;
        if (total >= maxBytes) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const p of parts) {
    const slice = p.subarray(0, merged.length - off);
    merged.set(slice, off);
    off += slice.length;
    if (off >= merged.length) break;
  }
  return { status: res.status, ctype: res.headers.get('content-type') || '', bytes: merged };
}

function ascii(bytes: Uint8Array, from = 0, to = bytes.length): string {
  return Array.from(bytes.subarray(from, Math.min(to, bytes.length)))
    // \n (10), \r (13) et \t (9) doivent être conservés : sans eux tout le
    // document fusionne en une ligne et le parsing playlist/HTML casse.
    .map((b) => (b === 10 || b === 13 || b === 9 || (b >= 32 && b < 127) ? String.fromCharCode(b) : ' '))
    .join('');
}

/** Nature d'un segment : 'ts' | 'mp4' | 'playlist' | null */
function classify(bytes: Uint8Array, ctype: string): string | null {
  if (bytes[0] === 0x47) return 'ts';
  const head = ascii(bytes, 0, 96).trimStart();
  if (head.startsWith('#EXTM3U')) return 'playlist';
  const box = ascii(bytes, 4, 8);
  if (['ftyp', 'styp', 'moof', 'mdat', 'sidx', 'free'].includes(box)) return 'mp4';
  if (/mpegurl/i.test(ctype)) return 'playlist';
  if (/video\/(mp2t|x-mpeg|mp4)/i.test(ctype)) return 'video';
  return null;
}

function resolveUrl(rel: string, base: string): string {
  try {
    return new URL(rel.trim(), base).toString();
  } catch {
    return rel.trim();
  }
}

/** Première URI utile d'une playlist (variante de master ou segment média). */
function firstUri(playlist: string, base: string): { url: string; kind: 'variant' | 'media' } | null {
  const lines = playlist.split(/\r?\n/).map((l) => l.trim());
  let isMaster = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) isMaster = true;
  }
  let seenExtinf = false;
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#')) {
      if (line.startsWith('#EXTINF')) seenExtinf = true;
      continue;
    }
    if (isMaster) return { url: resolveUrl(line, base), kind: 'variant' };
    if (seenExtinf) return { url: resolveUrl(line, base), kind: 'media' };
  }
  // repli : première ligne non-commentaire non m3u8
  for (const line of lines) {
    if (line && !line.startsWith('#')) return { url: resolveUrl(line, base), kind: 'media' };
  }
  return null;
}

/** hls : playlist → segment → preuve vidéo (max 2 niveaux de variantes). */
async function deepHls(url: string, headers: Record<string, string>): Promise<DeepResult> {
  const at = new Date().toISOString();
  try {
    let current = url;
    let depth = 0;
    for (;;) {
      const pl = await fetchBytes(current, headers, 16_384);
      const text = ascii(pl.bytes);
      if (!text.trimStart().startsWith('#EXTM3U') && !/mpegurl/i.test(pl.ctype)) {
        return { at, httpStatus: pl.status, segmentOk: false, error: `playlist invalide (${pl.ctype || 'type inconnu'})` };
      }
      const next = firstUri(text, current);
      if (!next) return { at, httpStatus: pl.status, segmentOk: false, error: 'playlist sans segment' };
      if (next.kind === 'variant' && depth < 2) {
        depth += 1;
        current = next.url;
        continue;
      }
      const seg = await fetchBytes(next.url, headers, 2_048);
      const kind = classify(seg.bytes, seg.ctype);
      const ok = seg.status === 200 || seg.status === 206;
      if (ok && (kind === 'ts' || kind === 'mp4' || kind === 'video')) {
        return { at, httpStatus: seg.status, segmentOk: true, segmentType: kind };
      }
      if (ok && kind === 'playlist') {
        // segment = playlist imbriquée : on la sonde une fois
        const seg2 = await fetchBytes(next.url, headers, 16_384);
        const inner = firstUri(ascii(seg2.bytes), next.url);
        if (inner && inner.kind === 'media') {
          const s2 = await fetchBytes(inner.url, headers, 2_048);
          const k2 = classify(s2.bytes, s2.ctype);
          if ((s2.status === 200 || s2.status === 206) && k2 && k2 !== 'playlist') {
            return { at, httpStatus: s2.status, segmentOk: true, segmentType: k2 };
          }
        }
      }
      return {
        at,
        httpStatus: seg.status,
        segmentOk: false,
        segmentType: kind || undefined,
        error: `segment non-video (${seg.ctype || 'type inconnu'})`,
      };
    }
  } catch (e) {
    return { at, segmentOk: false, error: (e as Error).message.slice(0, 160) };
  }
}

/** iframe : page → extraction des .m3u8 → sondage. */
async function deepIframe(url: string, headers: Record<string, string>): Promise<DeepResult> {
  const at = new Date().toISOString();
  try {
    const page = await fetchBytes(url, headers, 512_000);
    if (!(page.status === 200 || page.status === 304)) {
      return { at, httpStatus: page.status, extractedOk: false, error: `page HTTP ${page.status}` };
    }
    const html = ascii(page.bytes).replace(/\\\//g, '/').replace(/&amp;/g, '&');
    const found = new Set<string>();
    for (const m of html.matchAll(/https?:\/\/[^"'\\\s)]+?\.m3u8[^"'\\\s)]*/gi)) found.add(m[0]);
    for (const m of html.matchAll(/\/\/[^"'\\\s)]+?\.m3u8[^"'\\\s)]*/gi)) found.add(`https:${m[0]}`);
    const candidates = Array.from(found).slice(0, 4);
    if (candidates.length) {
      for (const cand of candidates) {
        const r = await deepHls(cand, { ...headers, Referer: headers['Referer'] || url });
        if (r.segmentOk) {
          return { at, httpStatus: page.status, extractedM3u8: cand, extractedOk: true };
        }
      }
    }

    // Repli : l'extracteur du backend (parse le JS des players connus :
    // kora-plus, sportokos, yasirtv, streamiz…) — mêmes outils qu'en prod.
    try {
      const extracted = await extractDirectStream(url, headers['Referer']);
      if (extracted?.m3u8Url) {
        const r = await deepHls(extracted.m3u8Url, {
          ...headers,
          Referer: extracted.referer || headers['Referer'] || url,
        });
        if (r.segmentOk) {
          return { at, httpStatus: page.status, extractedM3u8: extracted.m3u8Url, extractedOk: true };
        }
        return {
          at,
          httpStatus: page.status,
          extractedM3u8: extracted.m3u8Url,
          extractedOk: false,
          error: 'extracteur: m3u8 trouvé mais segment non-video',
        };
      }
    } catch {
      // extracteur best-effort
    }

    return {
      at,
      httpStatus: page.status,
      extractedOk: false,
      error: candidates.length
        ? 'm3u8 extrait mais segment non-video'
        : 'page OK, aucun m3u8 (chargement JS/API non reconnu)',
    };
  } catch (e) {
    return { at, extractedOk: false, error: (e as Error).message.slice(0, 160) };
  }
}

(async () => {
  const started = Date.now();
  const all = loadAll();
  let targets = Array.from(all.values()).filter((r) => r.probe?.playable);
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);
  console.log(`[deep] ${targets.length} lien(s) jouables(probe) à vérifier en profondeur`);

  let idx = 0;
  let ok = 0;
  let ko = 0;
  let done = 0;

  await (async () => {
    const runners = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, targets.length)) }, async () => {
      for (;;) {
        const i = idx++;
        if (i >= targets.length) return;
        const rec: ChannelRecord = targets[i];
        const headers: Record<string, string> = { 'User-Agent': UA };
        if (rec.referer) headers['Referer'] = rec.referer;
        const deep =
          rec.type === 'hls' ? await deepHls(rec.url, headers) : await deepIframe(rec.url, headers);
        rec.deep = deep;
        const good = rec.type === 'hls' ? !!deep.segmentOk : !!deep.extractedOk;
        if (good) ok += 1;
        else ko += 1;
        done += 1;
        const mark = good ? '✓' : '~';
        if (!good || done % 25 === 0) {
          const detail = rec.type === 'hls' ? deep.segmentType || deep.error : deep.extractedOk ? 'm3u8 ok' : deep.error;
          console.log(`[deep] ${mark} ${done}/${targets.length} ${rec.provider}/${rec.channelName} → ${detail}`);
        }
      }
    });
    await Promise.all(runners);
  })();

  saveAll(all);
  const hls = targets.filter((r) => r.type === 'hls');
  const iframes = targets.filter((r) => r.type === 'iframe');
  console.log('─────────────────────────────────────────────');
  console.log(`[deep] terminé en ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`[deep] segment vidéo prouvé (hls): ${hls.filter((r) => r.deep?.segmentOk).length}/${hls.length}`);
  console.log(`[deep] m3u8 extrait + prouvé (iframe): ${iframes.filter((r) => r.deep?.extractedOk).length}/${iframes.length}`);
  console.log(`[deep] iframe: page OK sans extraction statique: ${iframes.filter((r) => !r.deep?.extractedOk && r.probe?.playable).length}/${iframes.length}`);
  console.log(`[deep] au total: ${ok} confirmés, ${ko} non confirmés`);
})().catch((e) => {
  console.error('[deep] échec fatale:', e);
  process.exit(1);
});
