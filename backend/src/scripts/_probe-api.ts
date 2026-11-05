import { matchesService } from '../modules/matches/matches.service';

async function main() {
  const matches = await matchesService.getMatches({ sport: 'football' });
  console.log('total matches:', matches.length);
  const afc = matches.filter((m: any) => /afc/i.test(`${m.league?.name ?? ''} ${m.league?.slug ?? ''} ${m.homeTeam?.name ?? ''} ${m.awayTeam?.name ?? ''}`));
  console.log('afc-ish:', afc.map((m: any) => `${m.homeTeam?.name} vs ${m.awayTeam?.name} | ${m.league?.name} | status=${m.status}`));
  const saudi = matches.filter((m: any) => /saudi|ksa/i.test(`${m.league?.name ?? ''} ${m.league?.slug ?? ''} ${m.homeTeam?.name ?? ''}`));
  console.log('saudi-ish:', saudi.map((m: any) => `${m.homeTeam?.name} vs ${m.awayTeam?.name} | status=${m.status}`));
  console.log('ligues:', [...new Set(matches.map((m: any) => m.league?.name).filter(Boolean))].join(' | '));
  process.exit(0);
}
main().catch((e) => { console.error(e?.stack); process.exit(1); });
