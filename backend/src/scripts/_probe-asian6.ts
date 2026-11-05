import { sideScore } from '../modules/sports/utils/fixture-match';

const pairs = [
  ['Adelaide', 'Adelaida'],
  ['United', 'Yunayted'],
  ['Lion', 'Layon'],
  ['City', 'Siti'],
  ['Sailors', 'Seylors'],
  ['Adelaide United', 'Adelaida Yunayted'],
  ['Lion City Sailors', 'Layon Siti Seylors'],
  ['Kuching City', 'Kuching Siti'],
  ['Gangwon', 'Kanvon'],
  ['Shanghai Shenhua', 'Shanghai'],
  ['Tai Po', 'Tay Po'],
  ['Tampines Rovers', 'Tempayns'],
  ['Svay Rieng', 'Svayrieng'],
  ['BG Pathum', 'Bi Dzhi Patkum'],
];
for (const [a, b] of pairs) console.log(`${a.padEnd(18)} vs ${b.padEnd(20)} → ${sideScore(a, b).toFixed(2)}`);
process.exit(0);
