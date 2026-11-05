import axios from 'axios';
import { matchesService } from '../modules/matches/matches.service';
import { getSportsMatches } from '../modules/sports/sports.service';

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

async function main() {
  const espn: any = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/afc.cup/scoreboard?dates=${today}`, { timeout: 15000 });
  const providers = await getSportsMatches();
  for (const ev of espn?.data?.events ?? []) {
    const startMs = new Date(ev.date ?? ev.competitions?.[0]?.date ?? Date.now()).getTime();
    const teams = ev.competitions?.[0]?.competitors?.map((c: any) => c.team?.displayName) ?? [];
    const match = providers.find((p) => p.startTs !== undefined && Math.abs(p.startTs * 1000 - startMs) <= 90 * 60_000);
    console.log(`${ev.status?.type?.state?.padEnd(8)} | ${teams.join(' vs ')} | espnTs=${Math.floor(startMs / 1000)}`);
    if (match) {
      console.log(`              → provider détecté: ${match.home} vs ${match.away} (${match.source}:${match.slug ?? match.id}, ${match.startTs})`);
    } else {
      console.log('              → AUCUN provider à ±90 min');
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.message); process.exit(1); });
