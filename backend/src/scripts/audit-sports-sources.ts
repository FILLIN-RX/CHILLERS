/**
 * Smoke test des sources sports : liste des matchs, jouabilité du flux de chaque
 * source, puis chaîne de providers sur les matchs en direct (le premier qui
 * diffuse réellement est servi). Lancer manuellement avec :
 *   npx tsx src/scripts/audit-sports-sources.ts
 */
import {
  getSportsSourcesStatus,
  getSportsMatches,
  resolveSportsStream,
  resolveSportsFlux,
} from '../modules/sports/sports.service';
import { pickPlayableServer } from '../modules/sports/utils/stream-probe';
import { isSameFixture } from '../modules/sports/utils/fixture-match';
import { SPORTS_SOURCES } from '../modules/sports/sports.types';

const shortUrl = (url: string) => (url.length > 96 ? `${url.slice(0, 96)}…` : url);

async function main() {
  console.log('=== État des sources ===');
  const status = await getSportsSourcesStatus();
  for (const [name, s] of Object.entries(status)) {
    console.log(`  ${s.ok ? 'OK ' : 'KO '} ${name.padEnd(10)} ${s.count} match(s)`);
  }

  console.log('\n=== Matchs agrégés ===');
  const matches = await getSportsMatches();
  const live = matches.filter((m) => m.status === 'live');
  console.log(`  total=${matches.length} live=${live.length}`);

  console.log('\n=== Par source : résolution puis sonde de jouabilité ===');
  for (const source of SPORTS_SOURCES) {
    const first = matches.find((m) => m.source === source);
    if (!first) {
      console.log(`  -- ${source.padEnd(10)} aucune entrée dans la liste`);
      continue;
    }
    const started = Date.now();
    const stream = await resolveSportsStream(source, first.sourceId, true);
    if (!stream) {
      console.log(`  KO ${source.padEnd(10)} ${first.home} vs ${first.away} → flux introuvable (${Date.now() - started}ms)`);
      continue;
    }
    const playable = await pickPlayableServer(stream);
    const ms = Date.now() - started;
    if (!playable) {
      console.log(`  KO ${source.padEnd(10)} ${stream.type} annoncé (${stream.servers.length} serveur(s)) mais rien de jouable (${ms}ms)`);
      continue;
    }
    console.log(`  OK ${source.padEnd(10)} ${playable.type} en ${ms}ms → ${shortUrl(playable.url)}`);
  }

  console.log('\n=== Chaîne de providers (2 matchs par source) ===');
  const targets = SPORTS_SOURCES.flatMap((source) => {
    const rows = matches.filter((m) => m.source === source);
    const liveRows = rows.filter((m) => m.status === 'live');
    return [...liveRows, ...rows.filter((m) => m.status !== 'live')].slice(0, 2);
  }).slice(0, 10);
  let served = 0;
  for (const m of targets) {
    const twins = matches.filter((o) => o.id !== m.id && isSameFixture(m, o));
    const started = Date.now();
    const flux = await resolveSportsFlux(m, true);
    if (!flux) {
      console.log(
        `  KO ${m.id.padEnd(22)} ${m.home} vs ${m.away} → aucun provider jouable (jumeaux=${twins.length}, ${Date.now() - started}ms)`
      );
      continue;
    }
    served++;
    const via = flux.source === m.source ? flux.source : `${m.source} → ${flux.source}`;
    console.log(
      `  OK ${m.id.padEnd(22)} ${via} (${flux.stream.type}, jumeaux=${twins.length}, ${Date.now() - started}ms) ${shortUrl(flux.stream.url)}`
    );
  }
  console.log(`\n  ${served}/${targets.length} matchs servent un flux jouable.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
