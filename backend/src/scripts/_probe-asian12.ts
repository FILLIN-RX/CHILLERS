import { sideScore } from '../modules/sports/utils/fixture-match';
for (const [a, b] of [
  ['Lion City Sailors FC', 'Layon Siti Seylors'],
  ['Lion City Sailors FC', 'Kitchee SC'],
  ['Kitchee SC', 'Layon Siti Seylors'],
  ['Adelaide United FC', 'Adelaida Yunayted'],
  ['Adelaida Yunayted', 'Layon Siti Seylors'],
  ['Gangwon FC', 'Kuching Siti'],
  ['Gangwon FC', 'Kanvon'],
  ['Kuching City', 'Kuching Siti'],
]) console.log(`${a.padEnd(28)} vs ${b.padEnd(24)} → ${sideScore(a, b).toFixed(2)}`);
process.exit(0);
