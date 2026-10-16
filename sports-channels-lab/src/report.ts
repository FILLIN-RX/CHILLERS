/**
 * report.ts — vue « qui diffuse quoi » : le même fixture regroupé à travers
 * TOUS les providers, avec chaque chaîne/serveur, son lien et son état.
 *
 * Sortie : data/report.json + résumé console.
 *   tsx src/report.ts --min-playable=1 --json
 */
import { loadAll, dataFile, type ChannelRecord } from './record';
import { isSameFixture, fixtureScore } from '../../backend/src/modules/sports/utils/fixture-match';
import type { SportsMatch } from '../../backend/src/modules/sports/sports.types';
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (name: string, def?: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const MIN_PLAYABLE = Number(flag('min-playable', '0')) || 0;
const QUIET = args.includes('--quiet');

interface FixtureGroup {
  rep: Pick<SportsMatch, 'home' | 'away'> & { startTs?: number };
  league?: string;
  status?: string;
  records: ChannelRecord[];
}

(async () => {
  const all = Array.from(loadAll().values());
  if (!all.length) {
    console.log('[report] store vide — lance d’abord `npm run scan`.');
    return;
  }

  // 1) Regroupement inter-providers du même fixture
  //    Les chaînes « TV pures » (iptv-org : home/away vides) n'ont pas de
  //    fixture : elles partent dans une section dédiée ci-dessous.
  const groups: FixtureGroup[] = [];
  const tvChannels: typeof all = [];
  for (const rec of all) {
    if (!rec.home && !rec.away) {
      tvChannels.push(rec);
      continue;
    }
    const shape = { home: rec.home, away: rec.away, startTs: rec.startTs };
    const hit =
      groups.find((g) => isSameFixture(g.rep, shape)) ||
      // les entrées « canal seul » (away vide) ne groupent pas : fixtureScore = 0,
      // c'est voulu — on les garde en groupe solo pour les lister telles quelles.
      groups.find(
        (g) =>
          g.rep.away === shape.away &&
          g.rep.home === shape.home &&
          g.rep.home !== '' &&
          (g.rep.startTs ?? 0) === (shape.startTs ?? 0)
      );
    if (hit) {
      hit.records.push(rec);
      if (!hit.league && rec.league) hit.league = rec.league;
      if (rec.status === 'live') hit.status = 'live';
    } else {
      groups.push({ rep: shape, league: rec.league, status: rec.status, records: [rec] });
    }
  }

  // 2) Tri : directs d'abord, puis par coup d'envoi
  groups.sort((a, b) => {
    if ((a.status === 'live') !== (b.status === 'live')) return a.status === 'live' ? -1 : 1;
    return (a.rep.startTs ?? Number.MAX_SAFE_INTEGER) - (b.rep.startTs ?? Number.MAX_SAFE_INTEGER);
  });

  // 3) Totaux (+ niveaux de preuve deep)
  const confirmed = (r: ChannelRecord): boolean =>
    r.type === 'hls' ? !!r.deep?.segmentOk : !!r.deep?.extractedOk;
  const totals = {
    records: all.length,
    playable: all.filter((r) => r.probe?.playable).length,
    deepConfirmed: all.filter((r) => r.probe?.playable && confirmed(r)).length,
    pageOnly: all.filter((r) => r.probe?.playable && r.type === 'iframe' && !r.deep?.extractedOk).length,
    dead: all.filter((r) => r.probe && !r.probe.playable).length,
    notProbed: all.filter((r) => !r.probe).length,
    byProvider: {} as Record<string, { links: number; playable: number; confirmed: number }>,
  };
  for (const r of all) {
    const e = (totals.byProvider[r.provider] ??= { links: 0, playable: 0, confirmed: 0 });
    e.links += 1;
    if (r.probe?.playable) e.playable += 1;
    if (r.probe?.playable && confirmed(r)) e.confirmed += 1;
  }

  const fixtures = groups
    .map((g) => {
      const providers = Array.from(new Set(g.records.map((r) => r.provider)));
        const channels = g.records
          .map((r) => ({
            provider: r.provider,
            sourceId: r.sourceId,
            channelName: r.channelName,
            type: r.type,
            url: r.url,
            referer: r.referer,
            meta: r.meta,
            playable: r.probe?.playable ?? null,
            confirmed: r.probe?.playable ? confirmed(r) : false,
            httpStatus: r.probe?.httpStatus,
          }))
          .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || Number(b.playable === true) - Number(a.playable === true));
      return {
        home: g.rep.home,
        away: g.rep.away,
        startTs: g.rep.startTs ? new Date(g.rep.startTs * 1000).toISOString() : undefined,
        status: g.status,
        league: g.league,
        providers,
        playableCount: channels.filter((c) => c.playable === true).length,
        channels,
      };
    })
    .filter((f) => f.playableCount >= MIN_PLAYABLE);

  const tv = tvChannels
    .map((r) => ({
      name: r.channelName,
      provider: r.provider,
      url: r.url,
      logo: typeof r.meta?.logo === 'string' ? r.meta.logo : undefined,
      playable: r.probe?.playable ?? null,
      confirmed: r.probe?.playable ? confirmed(r) : false,
      httpStatus: r.probe?.httpStatus,
    }))
    .sort((a, b) => Number(b.confirmed) - Number(a.playable === true));

  // 4) Index inverse : « quelle chaîne diffuse quel match ? »
  interface ChannelIndexEntry {
    name: string;
    providers: string[];
    links: number;
    playable: number;
    confirmed: number;
    fixtures: { home: string; away: string; status?: string; league?: string; confirmed: boolean }[];
  }
  const byChannelMap = new Map<string, ChannelIndexEntry>();
  for (const r of all) {
    const ck = r.channelName.trim().toLowerCase();
    let entry = byChannelMap.get(ck);
    if (!entry) {
      entry = { name: r.channelName.trim(), providers: [], links: 0, playable: 0, confirmed: 0, fixtures: [] };
      byChannelMap.set(ck, entry);
    }
    entry.links += 1;
    if (r.probe?.playable) entry.playable += 1;
    if (r.probe?.playable && confirmed(r)) entry.confirmed += 1;
    if (!entry.providers.includes(r.provider)) entry.providers.push(r.provider);
    if (r.home || r.away) {
      const fk = `${r.home}|${r.away}`;
      if (!entry.fixtures.some((f) => `${f.home}|${f.away}` === fk)) {
        entry.fixtures.push({
          home: r.home,
          away: r.away,
          status: r.status,
          league: r.league,
          confirmed: r.probe?.playable ? confirmed(r) : false,
        });
      }
    }
  }
  const byChannel = Array.from(byChannelMap.values()).sort(
    (a, b) => b.fixtures.length - a.fixtures.length || b.confirmed - a.confirmed
  );

  fs.writeFileSync(
    dataFile('report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), totals, fixtures, tvChannels: tv, byChannel }, null, 2)
  );

  if (!QUIET) {
    console.log('════════ CHAÎNES / SERVEURS PAR MATCH ════════');
    for (const f of fixtures) {
      const head =
        f.startTs?.slice(5, 16).replace('T', ' ') +
        ` ${f.league ? `[${f.league}] ` : ''}${f.home} vs ${f.away}` +
        ` ${f.status === 'live' ? '🔴 LIVE' : ''}`;
      console.log(`\n▸ ${head}`);
      console.log(`  providers: ${f.providers.join(', ')} → ${f.playableCount} jouable(s)/${f.channels.length}`);
      for (const c of f.channels) {
        const mark = c.playable === true ? '✓' : c.playable === false ? '✗' : '?';
        console.log(`   ${mark} [${c.provider}] ${c.channelName} (${c.type}) ${c.url.slice(0, 78)}`);
      }
    }
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(
    `[report] ${fixtures.length} fixture(s) | liens: ${totals.records} (probe OK ${totals.playable}, ` +
      `vidéo prouvée ${totals.deepConfirmed}, iframe page-seule ${totals.pageOnly}, morts ${totals.dead})`
  );
  console.log(`[report] par provider: ${JSON.stringify(totals.byProvider)}`);
  if (tv.length) {
    console.log(`[report] chaînes TV (sans fixture): ${tv.length}, dont ${tv.filter((c) => c.confirmed).length} avec segment vidéo prouvé`);
  }

  // Index chaîne → matchs (« quelle chaîne diffuse quel match ? »)
  const withFixtures = byChannel.filter((c) => c.fixtures.length > 0);
  console.log('\n════════ CHAÎNE → MATCHS ════════');
  for (const c of withFixtures.slice(0, 15)) {
    const fixturesList = c.fixtures
      .map((f) => `${f.home} vs ${f.away}${f.status === 'live' ? ' 🔴' : ''}${f.confirmed ? ' ✓' : ''}`)
      .join(' · ');
    console.log(`  ▸ ${c.name} [${c.providers.join(',')}] → ${fixturesList}`);
  }
  if (withFixtures.length > 15) console.log(`  … +${withFixtures.length - 15} autres chaînes (report.json byChannel)`);
  console.log(`[report] ${byChannel.length} chaînes distinctes indexées, ${withFixtures.length} avec match(s)`);
  console.log(`[report] data/report.json écrit`);
})().catch((e) => {
  console.error('[report] échec:', e);
  process.exit(1);
});
