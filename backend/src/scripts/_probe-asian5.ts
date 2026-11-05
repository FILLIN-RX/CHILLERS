import { fixtureScore, isSameFixture } from '../modules/sports/utils/fixture-match';
import { getSportsMatches } from '../modules/sports/sports.service';

async function main() {
  const espn = {
    home: 'Lion City Sailors FC',
    away: 'Adelaide United FC',
  };
  const providers = await getSportsMatches();
  for (const p of providers) {
    const s = fixtureScore(espn as any, { home: p.home, away: p.away } as any);
    if (s > 0.1) console.log(`${p.home} vs ${p.away} (${p.source}) → ${s.toFixed(2)}`);
  }
  // also measure the two targets separately
  const pairs = [
    [{ home: 'Lion City Sailors FC', away: 'X' }, { home: 'Layon Siti Seylors', away: 'X' }],
    [{ home: 'Adelaide United FC', away: 'Y' }, { home: 'Adelaida Yunayted', away: 'Y' }],
  ];
  for (const [a, b] of pairs) {
    const s = fixtureScore(a as any, b as any);
    console.log(`min-side → ${s.toFixed(2)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e?.message); process.exit(1); });
