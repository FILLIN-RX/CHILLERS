import { fixtureScore, isSameFixture } from '../modules/sports/utils/fixture-match';

const pairs: Array<[string, string]> = [
  ['Lion City Sailors FC', 'Adelaida Yunayted'],
  ['Adelaide United FC', 'Layon Siti Seylors'],
  ['Kuching City', 'Kuching Siti'],
  ['Kuching City', 'Gengvon'],
  ['Kuching City', 'Kanvon'],
  ['Gangwon FC', 'Kanvon'],
  ['Tai Po FC', 'Tay Po'],
  ['BG Pathum United', 'Bi Dzhi Patkum Yunayted'],
  ['SVAYRIENG', 'Svayrieng'],
  ['Tampines Rovers FC', 'Tempayns'],
  ['Kuching City', 'Kuching Siti'],
  ['Lion City Sailors FC', 'Kuching Siti'],
];

for (const [a, b] of pairs) {
  const s = fixtureScore({ home: a, away: 'X' } as any, { home: b, away: 'X' } as any);
  console.log(`${a.padEnd(28)} vs ${b.padEnd(28)} → ${s.toFixed(2)}`);
}
process.exit(0);
