import { getSportsMatches } from '../modules/sports/sports.service';

async function main() {
  const m = await getSportsMatches();
  for (const x of m as any[]) {
    console.log(`${x.status.padEnd(10)} ${x.home} vs ${x.away} | ${x.source} | ${x.league ?? '?'} | kickoff=${x.startTs ?? ''}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.stack); process.exit(1); });
