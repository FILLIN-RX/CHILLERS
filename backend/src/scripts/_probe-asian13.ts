import { teamTokens, sideScore } from '../modules/sports/utils/fixture-match';
for (const [a, b] of [
  ['Lion City Sailors FC', 'Layon Siti Seylors'],
  ['Lion City Sailors FC', 'Kitchee SC'],
  ['Kitchee SC', 'Layon Siti Seylors'],
  ['Adelaide United FC', 'Adelaide United FC'],
  ['Kuching City', 'Kuching Siti'],
]) {
  console.log(`tokens(${a}) → [${teamTokens(a)}] | tokens(${b}) → [${teamTokens(b)}] | score=${sideScore(a, b).toFixed(2)}`);
}
process.exit(0);
