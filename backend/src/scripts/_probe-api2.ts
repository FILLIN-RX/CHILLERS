import { matchesService } from '../modules/matches/matches.service';

async function main() {
  const matches = await matchesService.getMatches({ sport: 'football' });
  const afc = matches.filter((m: any) => /afc|asians|machida|adelaide|shanghai/i.test(`${m.league?.name ?? ''} ${m.homeTeam?.name ?? ''} ${m.awayTeam?.name ?? ''}`));
  for (const m of afc as any[]) {
    console.log(`${m.status.padEnd(10)} ${m.homeTeam?.name} vs ${m.awayTeam?.name} | ${m.league?.name} | kickoff=${m.startTime}`);
  }
  console.log('count:', afc.length);
  process.exit(0);
}
main().catch((e) => { console.error(e?.stack); process.exit(1); });
