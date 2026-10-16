/**
 * probe.ts — jouabilité de CHAQUE lien enregistré.
 *
 * hls    : GET (Range 0-4 Ko, Referer/UA de la source) → la réponse doit
 *          démarrer par #EXTM3U (ou exposer un content-type mpegurl).
 * iframe : GET de la page du player → 200 + corps suffisant.
 *
 * Un lien qui jouait et qui ne joue plus marque `deadAt` (historique conservé).
 *
 * Usage :
 *   tsx src/probe.ts              # uniquement les liens jamais sondés
 *   tsx src/probe.ts --refresh    # tout re-sonder
 *   tsx src/probe.ts --concurrency=8
 */
import { loadAll, saveAll, type ChannelRecord, type ProbeResult } from './record';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
const flag = (name: string, def?: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const REFRESH = args.includes('--refresh');
const CONCURRENCY = Number(flag('concurrency', '6')) || 6;
const TIMEOUT_MS = Number(flag('timeout', '9000')) || 9000;

async function readFirst(res: Response, maxBytes: number): Promise<{ chunk: Uint8Array; total: number }> {
  const reader = res.body?.getReader();
  if (!reader) return { chunk: new Uint8Array(0), total: 0 };
  const parts: Uint8Array[] = [];
  let total = 0;
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
  const merged = new Uint8Array(Math.min(total, maxBytes));
  let off = 0;
  for (const p of parts) {
    const slice = p.subarray(0, merged.length - off);
    merged.set(slice, off);
    off += slice.length;
    if (off >= merged.length) break;
  }
  return { chunk: merged, total };
}

async function probeOne(rec: ChannelRecord, prev?: ProbeResult): Promise<ProbeResult> {
  const at = new Date().toISOString();
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (rec.referer) headers['Referer'] = rec.referer;

  try {
    if (rec.type === 'hls') {
      let res = await fetch(rec.url, {
        headers: { ...headers, Range: 'bytes=0-4095' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });
      if (res.status === 416) {
        res = await fetch(rec.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
      }
      const { chunk } = await readFirst(res, 4096);
      const head = new TextDecoder('utf-8').decode(chunk.subarray(0, 96)).trimStart();
      const ctype = res.headers.get('content-type') || '';
      const looksM3u = head.startsWith('#EXTM3U') || /mpegurl|x-mpegurl/i.test(ctype);
      const playable = res.ok && looksM3u;
      const probe: ProbeResult = {
        at,
        httpStatus: res.status,
        contentType: ctype,
        playable,
        directM3u8: playable ? rec.url : undefined,
        error: res.ok ? (looksM3u ? undefined : `réponse non-playlist (${ctype || 'type inconnu'})`) : `HTTP ${res.status}`,
      };
      if (!playable && prev?.playable) probe.deadAt = at;
      return probe;
    }

    // iframe : page du player
    const res = await fetch(rec.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
    const { chunk, total } = await readFirst(res, 32_768);
    const ctype = res.headers.get('content-type') || '';
    const bodyLen = total;
    const playable = res.ok && /html/i.test(ctype || 'text/html') && bodyLen > 300;
    const probe: ProbeResult = {
      at,
      httpStatus: res.status,
      contentType: ctype,
      playable,
      error: res.ok ? (playable ? undefined : `page trop courte (${bodyLen} o)`) : `HTTP ${res.status}`,
    };
    if (!playable && prev?.playable) probe.deadAt = at;
    return probe;
  } catch (e) {
    const probe: ProbeResult = { at, playable: false, error: (e as Error).message.slice(0, 160) };
    if (prev?.playable) probe.deadAt = at;
    return probe;
  }
}

(async () => {
  const started = Date.now();
  const all = loadAll();
  const records = Array.from(all.values());
  const targets = REFRESH ? records : records.filter((r) => !r.probe);
  console.log(`[probe] ${targets.length}/${records.length} lien(s) à sonder (refresh=${REFRESH})`);

  let done = 0;
  let playable = 0;
  let dead = 0;
  let idx = 0;

  await (async () => {
    const runners = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, targets.length)) }, async () => {
      for (;;) {
        const i = idx++;
        if (i >= targets.length) return;
        const rec = targets[i];
        const prev = rec.probe;
        const probe = await probeOne(rec, prev);
        rec.probe = probe;
        if (probe.playable) playable += 1;
        if (probe.deadAt) dead += 1;
        done += 1;
        const mark = probe.playable ? '✓' : probe.deadAt ? '†' : '✗';
        if (!probe.playable || done % 25 === 0) {
          console.log(
            `[probe] ${mark} ${done}/${targets.length} ${rec.provider}/${rec.channelName} → ${probe.httpStatus ?? 'ERR'} ${probe.error || ''}`
          );
        }
      }
    });
    await Promise.all(runners);
  })();

  saveAll(all);
  const reaped = Array.from(all.values()).filter((r) => r.probe && !r.probe.playable).length;
  console.log('─────────────────────────────────────────────');
  console.log(`[probe] terminé en ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`[probe] ${targets.length} sondés: ${playable} jouables, ${targets.length - playable} non`);
  console.log(`[probe] ${dead} lien(s) passés de jouable → mort pendant ce run`);
  console.log(`[probe] état global du store: ${all.size} liens, ${reaped} non jouables`);
})().catch((e) => {
  console.error('[probe] échec fatale:', e);
  process.exit(1);
});
