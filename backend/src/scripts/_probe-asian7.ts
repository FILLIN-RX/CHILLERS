import { matchesService } from '../modules/matches/matches.service';
import { findSportsMatchByTeams } from '../modules/sports/sports.service';

async function main() {
  for (const id of ['401912761', '401912760', '401912758', '401912756', '401912757']) {
    const m = await matchesService.getMatchById(id);
    if (!m) { console.log('getMatchById null for', id); continue; }
    const found = await findSportsMatchByTeams(m.homeTeam.name, m.awayTeam.name);
    console.log(`${id} ${m.homeTeam.name} vs ${m.awayTeam.name} | ${m.status} → ${found ? `${found.source} n=${found.home}` : 'AUCUN jumeau'}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.message); process.exit(1); });
