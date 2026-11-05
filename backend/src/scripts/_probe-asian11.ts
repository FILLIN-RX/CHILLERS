import { fixtureScore, isSameFixture } from '../modules/sports/utils/fixture-match';

const espnAsian = [
  ['Lion City Sailors FC', 'Adelaide United FC'],
  ['Kitchee SC', 'Adelaide United FC'],
  ['BG Pathum United', 'Tai Po FC'],
  ['Gangwon FC', 'Kuching City'],
  ['Tampines Rovers FC', 'PKR Svay Rieng'],
];

const providerAsian = [
  ['Layon Siti Seylors', 'Adelaida Yunayted'],
  ['Kitchee SC', 'Adelaida Yunayted'],
  ['Bi Dzhi Patkhum Yunayted', 'Tay Po'],
  ['Kuching Siti', 'Kanvon'],
  ['Tempayns', 'Svayrieng'],
];

for (const [home, away] of espnAsian) {
  console.log(`\n${home} vs ${away}`);
  for (const [h, a] of providerAsian) {
    const s = fixtureScore({ home, away } as any, { home: h, away: a } as any);
    const ok = isSameFixture({ home, away, startTs: 1793872800 } as any, { home: h, away: a, startTs: 1793872800 } as any);
    if (s > 0.4 || ok) console.log(`  ├─ ${h} vs ${a} → ${s.toFixed(2)} ${ok ? '(SAME)' : ''}`);
  }
}
process.exit(0);
