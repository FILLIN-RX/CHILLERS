import axios from 'axios';
import { getSportsMatches } from '../modules/sports/sports.service';

async function main() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { data } = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${d}`, { timeout: 15000 });
  const events: any[] = data?.events ?? [];
  console.log('global events:', events.length);
  let withLeague = 0;
  for (const ev of events) if (ev.league && Object.keys(ev.league).length) withLeague++;
  console.log('avec objet league:', withLeague);
  console.log('échantillons avec league vide:', events.slice(0, 5).map((e: any) => `${e.name} [league=${JSON.stringify(e.league)}]`));

  const matches = await getSportsMatches();
  console.log('providers matches:', matches.length);
  const saudi = matches.filter((m) => /saudi|pro league|khalood|abha|qadsiah|al nassr|al ittihad|al hilal/i.test(`${m.home} ${m.away} ${m.league ?? ''}`));
  console.log('saudi-ish providers:', saudi.map(m => `${m.home} vs ${m.away} (${m.status}, ${m.league ?? '?'})`));
  process.exit(0);
}
main().catch((e) => { console.error(e?.message); process.exit(1); });
