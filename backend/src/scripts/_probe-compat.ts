import {  teamTokens, sideScore } from '../modules/sports/utils/fixture-match';

// Recreate sameToken inline by side-channel; import internal fn not exported — test via teakTokens+sideScore
for (const [a, b] of [
  ['lion', 'kitchee'],
  ['city', 'kitchee'],
  ['Sailors FC', 'Kitchee SC'],
  ['Lion City Sailors FC', 'Kitchee FC'],
]) {
  console.log(`\n${a} vs ${b}`);
  console.log('  tokens:', teamTokens(a), '||', teamTokens(b), '→ score', sideScore(a, b));
}
process.exit(0);
