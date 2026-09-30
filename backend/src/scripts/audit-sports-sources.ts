/**
 * Smoke test des sources sports : liste des matchs + résolution du premier flux
 * disponible pour chaque source. Lancer manuellement avec :
 *   npx tsx src/scripts/audit-sports-sources.ts
 */
import { getSportsSourcesStatus, getSportsMatches, resolveSportsStream } from '../modules/sports/sports.service';
import { SPORTS_SOURCES } from '../modules/sports/sports.types';

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
  for (const m of live.slice(0, 10)) {
    console.log(`  [${m.source}] ${m.home}${m.away ? ` vs ${m.away}` : ''}${m.score ? `  (${m.score})` : ''}`);
  }

  console.log('\n=== Résolution des flux (1er match live par source) ===');
  for (const source of SPORTS_SOURCES) {
    const first = live.find((m) => m.source === source);
    if (!first) {
      console.log(`  -- ${source.padEnd(10)} aucun match live`);
      continue;
    }
    const started = Date.now();
    const stream = await resolveSportsStream(source, first.sourceId);
    if (!stream) {
      console.log(`  KO ${source.padEnd(10)} flux introuvable (${Date.now() - started}ms)`);
      continue;
    }
    console.log(`  OK ${source.padEnd(10)} ${stream.type} · ${stream.servers.length} serveur(s) (${Date.now() - started}ms)`);
    for (const s of stream.servers.slice(0, 3)) {
      console.log(`       - ${s.name}: ${s.url.slice(0, 110)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
