import axios from 'axios';
import { matchesService } from '../modules/matches/matches.service';
import { findSportsMatchByTeams } from '../modules/sports/sports.service';

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

async function main() {
  const { data } = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/afc.cup/scoreboard?dates=${today}`, { timeout: 15000 });
  const evs: any[] = data?.events ?? [];
  for (const ev of evs) {
    const teams = ev.competitions?.[0]?.competitors?.map((c: any) => c.team?.displayName) ?? [];
    const state = ev.status?.type?.state;
    console.log(`${state.padEnd(8)} id=${ev.id}  ${teams.join(' vs ')}`);
    const found = await findSportsMatchByTeams(teams[0] ?? '', teams[1] ?? '');
    console.log(`            → findSportsMatchByTeams: ${found ? `${found.source}:${found.slug ?? found.id} (${found.home} vs ${found.away}, ${found.status})` : 'AUCUN'}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.message); process.exit(1); });
