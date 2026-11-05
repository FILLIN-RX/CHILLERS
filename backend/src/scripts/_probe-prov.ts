import { getSportsMatches } from '../modules/sports/sports.service';

async function main() {
  const m = await getSportsMatches();
  console.log('providers total:', m.length);
  const targets = /lion city|adelaide|machida|shanghai|kitchee|tai po|gangwon|kuching|pkR|tampines|bg pathum|seoul|buriram|kashima|gamba|pohang|buri/i;
  for (const x of m as any[]) {
    if (targets.test(`${x.home} ${x.away}`)) {
      console.log(`${x.status.padEnd(10)} ${x.home} vs ${x.away} | ${x.source} | ${x.league ?? '?'}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.stack); process.exit(1); });
