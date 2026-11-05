import { sideScore } from '../modules/sports/utils/fixture-match';
const pairs = [
  ['BG Pathum United', 'Bi Dzhi Patkhum Yunayted'],
  ['Tai Po FC', 'Tay Po'],
];
for (const [a, b] of pairs) console.log(sideScore(a, b).toFixed(2));
process.exit(0);
