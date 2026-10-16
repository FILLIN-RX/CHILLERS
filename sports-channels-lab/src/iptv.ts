/**
 * iptv.ts — source complémentaire « web ».
 *
 * Comme les concurrents agrègent des listes publiques : on télécharge la
 * playlist officielle iptv-org des chaînes sport (465 entrées, flux publics),
 * on filtre sur les diffuseurs de foot, on sonde chaque lien et on enregistre
 * dans le même store JSONL (provider `iptv-org`) — le rapport les fusionne
 * ensuite aux chaînes des providers de matchs.
 *
 * Usage :
 *   tsx src/iptv.ts                          # filtre foot par défaut
 *   tsx src/iptv.ts --all                    # les 465 chaînes
 *   tsx src/iptv.ts --filter=beIN|Canal      # regex perso
 *   tsx src/iptv.ts --limit=40 --concurrency=8
 */
import { makeKey, mergeAndSave, type ChannelRecord, type ProbeResult } from './record';

const M3U_URL = 'https://iptv-org.github.io/iptv/categories/sports.m3u';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_FILTER =
  'beIN|canal\\+?|eurosport|sky sport|tnt sport|trt spor|magenta sport|ziggo sport|eleven|dazn|ssc sport|alkass|rotana|rmc sport|sfr sport|prime video sport|sony sport|ten sport';

const args = process.argv.slice(2);
const flag = (name: string, def?: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const ALL = args.includes('--all');
const LIMIT = Number(flag('limit', '0')) || 0;
const CONCURRENCY = Number(flag('concurrency', '8')) || 8;
const FILTER = new RegExp(flag('filter', ALL ? '$^' : DEFAULT_FILTER), 'i');

interface M3uEntry {
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

function parseM3u(text: string): M3uEntry[] {
  const entries: M3uEntry[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF')) continue;
    const attrs: Record<string, string> = {};
    for (const m of line.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
    const name = (line.split(',').pop() || '').trim();
    const url = (lines[i + 1] || '').trim();
    if (name && url && !url.startsWith('#')) {
      entries.push({ name, url, logo: attrs['tvg-logo'], group: attrs['group-title'] });
    }
  }
  return entries;
}

async function probeHls(url: string): Promise<ProbeResult> {
  const at = new Date().toISOString();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Range: 'bytes=0-4095' },
      signal: AbortSignal.timeout(9000),
      redirect: 'follow',
    });
    const reader = res.body?.getReader();
    let head = '';
    if (reader) {
      const { value } = await reader.read();
      head = new TextDecoder('utf-8').decode((value ?? new Uint8Array(0)).subarray(0, 64)).trimStart();
      await reader.cancel().catch(() => undefined);
    }
    const ctype = res.headers.get('content-type') || '';
    const playable = res.ok && (head.startsWith('#EXTM3U') || /mpegurl/i.test(ctype));
    return {
      at,
      httpStatus: res.status,
      contentType: ctype,
      playable,
      directM3u8: playable ? url : undefined,
      error: res.ok ? (playable ? undefined : `réponse non-playlist (${ctype || 'type inconnu'})`) : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { at, playable: false, error: (e as Error).message.slice(0, 160) };
  }
}

(async () => {
  const started = Date.now();
  console.log(`[iptv] téléchargement ${M3U_URL}`);
  const res = await fetch(M3U_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`playlist HTTP ${res.status}`);
  const all = parseM3u(await res.text());
  let picked = all.filter((e) => FILTER.test(e.name));
  if (LIMIT > 0) picked = picked.slice(0, LIMIT);
  console.log(`[iptv] ${all.length} chaînes dans la playlist | filtre → ${picked.length}`);

  const records: ChannelRecord[] = [];
  let done = 0;
  let idx = 0;
  let playable = 0;

  await (async () => {
    const runners = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, picked.length)) }, async () => {
      for (;;) {
        const i = idx++;
        if (i >= picked.length) return;
        const e = picked[i];
        const probe = await probeHls(e.url);
        if (probe.playable) playable += 1;
        const now = new Date().toISOString();
        records.push({
          key: makeKey({ provider: 'iptv-org', sourceId: e.group || 'sports', channelName: e.name, url: e.url }),
          provider: 'iptv-org',
          sourceId: e.group || 'sports',
          home: '',
          away: '',
          channelName: e.name,
          url: e.url,
          type: 'hls',
          meta: e.logo ? { logo: e.logo, group: e.group || '' } : { group: e.group || '' },
          firstSeen: now,
          lastSeen: now,
          probe,
        });
        done += 1;
        const mark = probe.playable ? '✓' : '✗';
        if (!probe.playable || done % 15 === 0) {
          console.log(`[iptv] ${mark} ${done}/${picked.length} ${e.name} → ${probe.httpStatus ?? 'ERR'}`);
        }
      }
    });
    await Promise.all(runners);
  })();

  const saved = mergeAndSave(records);
  console.log('─────────────────────────────────────────────');
  console.log(`[iptv] terminé en ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`[iptv] ${records.length} chaînes testées: ${playable} jouables`);
  console.log(`[iptv] store: +${saved.created} créés, ${saved.updated} mis à jour, ${saved.total} total`);
})().catch((e) => {
  console.error('[iptv] échec:', e);
  process.exit(1);
});
