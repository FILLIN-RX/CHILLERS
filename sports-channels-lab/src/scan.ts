/**
 * scan.ts — INTERROGER TOUS LES PROVIDERS, puis TOUT ENREGISTRER.
 *
 * 1. `list()` de chaque provider (brut, sans le filtre `away` de
 *    getSportsMatches : les entrées « canal seul » de yallapro sont voulues).
 * 2. Pour CHAQUE match de CHAQUE provider : `resolve()` → TOUS les serveurs
 *    (pas d'arrêt au premier comme fait resolveSportsFlux en prod).
 * 3. Pour kora : dump brut des canaux (`channels[]` : ch, language, category,
 *    edge) rattaché aux serveurs correspondants.
 * 4. Tout part dans data/channels.jsonl (merge, re-scan sans doublon).
 *
 * Usage :
 *   tsx src/scan.ts                          # tout, tous providers
 *   tsx src/scan.ts --providers=kora,yallapro
 *   tsx src/scan.ts --live --limit=8 --concurrency=3
 *   tsx src/scan.ts --no-resolve             # listes seules (rapide)
 */
import {
  getLiveBallMatches,
  resolveLiveBallStream,
} from '../../backend/src/modules/liveball/liveball.service';
import { getKoraMatches, resolveKoraStream, koraDecode } from '../../backend/src/modules/sports/kora.service';
import {
  getKooorahMatches,
  getYallaproMatches,
  resolveKooorahStream,
  resolveYallaproStream,
} from '../../backend/src/modules/sports/yasirtv.service';
import { getStreamizMatches, resolveStreamizStream } from '../../backend/src/modules/sports/livetv.service';
import type {
  ResolvedSportsStream,
  SportsMatch,
  SportsServer,
  SportsSourceId,
} from '../../backend/src/modules/sports/sports.types';
import { makeKey, mergeAndSave, dataFile, type ChannelRecord } from './record';
import fs from 'node:fs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const KORA_API = 'https://cdn.kora-api.org/';

/* ── CLI ─────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const flag = (name: string, def?: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const num = (name: string, def: number): number => Number(flag(name, String(def))) || def;

const ALL: SportsSourceId[] = ['liveball', 'kora', 'kooorah', 'yallapro', 'streamiz'];
const providers = (flag('providers') || ALL.join(',')).split(',').map((s) => s.trim()) as SportsSourceId[];
const LIMIT = num('limit', 0);
const ONLY_LIVE = has('live');
const NO_RESOLVE = has('no-resolve');
const CONCURRENCY = num('concurrency', 4);

/* ── Listes brutes par provider ──────────────────────────────────── */
const LISTS: Record<SportsSourceId, () => Promise<SportsMatch[] | null>> = {
  liveball: async () =>
    ((await getLiveBallMatches()) || []).map((m) => ({
      id: `liveball:${m.id}`,
      sourceId: m.id,
      source: 'liveball' as const,
      status: m.status,
      home: m.home,
      away: m.away,
      homeLogo: m.homeLogo,
      awayLogo: m.awayLogo,
      league: m.league,
      score: m.score,
      startTs: m.startTs,
    })),
  kora: getKoraMatches,
  kooorah: getKooorahMatches,
  yallapro: getYallaproMatches,
  streamiz: getStreamizMatches,
};

const RESOLVERS: Record<SportsSourceId, (sourceId: string, force?: boolean) => Promise<ResolvedSportsStream | null>> = {
  liveball: async (id) => {
    const r = await resolveLiveBallStream(id);
    if (!r?.url) return null;
    return { url: r.url, type: r.type || 'hls', servers: [{ name: 'Serveur 1', url: r.url, type: r.type || 'hls' }] };
  },
  kora: resolveKoraStream,
  kooorah: resolveKooorahStream,
  yallapro: resolveYallaproStream,
  streamiz: resolveStreamizStream,
};

/* ── Divers ──────────────────────────────────────────────────────── */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: timeout ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function pool<T>(items: T[], concurrency: number, worker: (item: T, i: number) => Promise<void>): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const i = idx++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

/** Canaux kora bruts (ch, language, category, edge) — réutilise koraDecode. */
async function koraDetailChannels(sourceId: string): Promise<any[]> {
  const res = await fetch(
    `${KORA_API}api/v1/matche/${encodeURIComponent(sourceId)}/en?t=${Date.now()}`,
    {
      headers: { 'User-Agent': UA, Accept: 'text/plain,*/*', Referer: KORA_API },
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!res.ok) return [];
  const decoded = koraDecode(await res.text());
  const channels = decoded?.match?.channels;
  return Array.isArray(channels) ? channels : [];
}

function buildRecords(provider: SportsSourceId, match: SportsMatch, servers: SportsServer[]): ChannelRecord[] {
  const now = new Date().toISOString();
  return servers
    .filter((s) => s?.url)
    .map((s) => {
      const rec: ChannelRecord = {
        key: makeKey({ provider, sourceId: match.sourceId, channelName: s.name || 'Serveur', url: s.url }),
        provider,
        sourceId: match.sourceId,
        home: match.home,
        away: match.away,
        league: match.league,
        startTs: match.startTs,
        status: match.status,
        channelName: s.name || 'Serveur',
        url: s.url,
        type: s.type ?? 'hls',
        referer: s.referer,
        firstSeen: now,
        lastSeen: now,
      };
      return rec;
    });
}

/* ── Main ────────────────────────────────────────────────────────── */
(async () => {
  const started = Date.now();
  console.log(`[scan] providers=${providers.join(',')} limit=${LIMIT || '∞'} live=${ONLY_LIVE} resolve=${!NO_RESOLVE}`);

  // 1) Listes en parallèle (brutes, sans filtre away)
  const results = await Promise.all(
    providers.map(async (p) => {
      try {
        const raw = await withTimeout(LISTS[p](), 45_000, `list ${p}`);
        return { p, matches: (raw || []) as SportsMatch[] };
      } catch (e) {
        console.warn(`[scan] liste ${p} en échec: ${(e as Error).message}`);
        return { p, matches: [] as SportsMatch[] };
      }
    })
  );

  let allMatches: SportsMatch[] = [];
  const fixturesSnapshot: Record<string, unknown> = {};
  for (const { p, matches } of results) {
    let picked = matches;
    if (ONLY_LIVE) picked = picked.filter((m) => m.status === 'live');
    if (LIMIT > 0) picked = picked.slice(0, LIMIT);
    fixturesSnapshot[p] = picked;
    allMatches = allMatches.concat(picked);
    console.log(`[scan] ${p}: ${picked.length}/${matches.length} match(s)`);
  }

  // Snapshot des listes (« tout enregistrer », planning compris)
  fs.writeFileSync(
    dataFile('fixtures.json'),
    JSON.stringify({ scannedAt: new Date().toISOString(), providers }, null, 2) + '\n' +
      JSON.stringify(fixturesSnapshot, null, 2)
  );

  if (NO_RESOLVE) {
    console.log('[scan] --no-resolve : listes enregistrées, résolution sautée.');
    return;
  }

  // 2) Résolution : le match du provider A déclenche aussi la résolution
  //    chez les providers B/C qui ont le même fixture (union, pas 1er arrivé).
  allMatches.sort((a, b) => (a.status === b.status ? (a.startTs ?? 0) - (b.startTs ?? 0) : a.status === 'live' ? -1 : 1));

  const collected: ChannelRecord[] = [];
  let done = 0;
  let withServers = 0;

  await pool(allMatches, CONCURRENCY, async (match) => {
    const p = match.source;
    try {
      const resolved = await withTimeout(
        Promise.resolve(RESOLVERS[p](match.sourceId, false)),
        30_000,
        `resolve ${p}:${match.sourceId}`
      );
      const servers = resolved?.servers?.length
        ? resolved.servers
        : resolved?.url
          ? [{ name: 'Serveur 1', url: resolved.url, type: resolved.type ?? 'hls' } satisfies SportsServer]
          : [];
      if (servers.length) withServers += 1;

      const records = buildRecords(p, match, servers);

      // 3) kora : métadonnées brutes des canaux rattachées par server_name
      if (p === 'kora' && servers.length) {
        try {
          const rawChannels = await koraDetailChannels(match.sourceId);
          for (const rec of records) {
            const raw = rawChannels.find((c) => c?.server_name && rec.channelName.startsWith(String(c.server_name)));
            if (raw) {
              rec.meta = { ch: raw.ch, language: raw.language, category: raw.category, edge: raw.edge, koraType: raw.type };
            }
          }
        } catch {
          // dump brut best-effort
        }
      }

      collected.push(...records);
      if (servers.length) {
        console.log(
          `[scan] ✓ ${p}:${match.sourceId} ${match.home} vs ${match.away} → ${servers.length} serveur(s): ${servers
            .map((s) => s.name)
            .join(' | ')}`
        );
      }
    } catch (e) {
      console.warn(`[scan] ✗ ${p}:${match.sourceId} — ${(e as Error).message}`);
    } finally {
      done += 1;
      if (done % 10 === 0) console.log(`[scan] progression ${done}/${allMatches.length}`);
    }
  });

  const saved = mergeAndSave(collected);
  const byProvider: Record<string, number> = {};
  for (const r of collected) byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
  console.log('─────────────────────────────────────────────');
  console.log(`[scan] terminé en ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`[scan] matchs scannés: ${allMatches.length} | avec serveurs: ${withServers}`);
  console.log(`[scan] liens enregistrés: +${saved.created} créés, ${saved.updated} mis à jour, ${saved.total} total`);
  console.log(`[scan] par provider: ${JSON.stringify(byProvider)}`);
})().catch((e) => {
  console.error('[scan] échec fatale:', e);
  process.exit(1);
});
