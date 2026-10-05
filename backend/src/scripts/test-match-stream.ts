import { matchesService } from '../modules/matches/matches.service';
import { getSportsMatches } from '../modules/sports/sports.service';

async function test() {
  console.log('--- 1. Récupération des matchs Scrapers ---');
  const scraperMatches = await getSportsMatches();
  console.log(`Nombre de matchs Scrapers trouvés: ${scraperMatches.length}`);
  for (const s of scraperMatches.slice(0, 15)) {
    console.log(`  [${s.source}] ${s.home} vs ${s.away} (${s.status})`);
  }

  console.log('\n--- 2. Récupération des matchs ESPN LIVE ---');
  const espnMatches = await matchesService.getMatches({ date: new Date().toISOString().split('T')[0], sport: 'football' });
  const liveEspn = espnMatches.filter(m => m.status === 'live');
  console.log(`Nombre de matchs ESPN LIVE: ${liveEspn.length}`);
  for (const m of liveEspn) {
    console.log(`  [ESPN: ${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.minute})`);
  }

  console.log('\n--- 3. Résolution des flux pour les matchs ESPN LIVE ---');
  for (const m of liveEspn) {
    const stream = await matchesService.getMatchStream(m.id);
    if (stream) {
      console.log(`\n MATCH REUSSI pour [${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name}:`);
      console.log(`   Source: ${stream.source} (${stream.sourceId})`);
      console.log(`   Type: ${stream.type}`);
      console.log(`   URL: ${stream.url}`);
      console.log(`   Serveurs: ${stream.servers.length}`);
      stream.servers.forEach((s: any, idx: number) => {
        console.log(`     - [${s.type}] ${s.name}: ${s.url}`);
      });
    } else {
      console.log(`\n❌ ÉCHEC pour [${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name}`);
    }
  }
}

test().catch(console.error);
