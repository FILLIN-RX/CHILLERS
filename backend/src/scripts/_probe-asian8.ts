import { getSportsMatches } from '../modules/sports/sports.service';

async function main() {
  const m = await getSportsMatches();
  for (const x of m as any[]) {
    if (/seylors|adelaida|tai po|tay po|svaj|patkum|kanvon|tempayns|kitchee|machida|shanghai|gangli|pathum|tampines/i.test(`${x.home} ${x.away} ${x.league ?? ''}`)) {
      console.log(JSON.stringify(x, null, 1));
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.message); process.exit(1); });
