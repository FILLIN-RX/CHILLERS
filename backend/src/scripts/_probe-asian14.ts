const { teamTokens, compatible, sameToken } = require('../modules/sports/utils/fixture-match');
for (const [a, b] of [
  ['lion', 'kitchee'],
  ['city', 'kitchee'],
  ['sailors', 'kitchee'],
]) console.log(`${a} vs ${b} → same=${sameToken ? 'n/a' : ''}`);
process.exit(0);
