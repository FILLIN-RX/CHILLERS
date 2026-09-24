import { resolveLiveBallStream } from '/home/ruxel/CHILLERS/backend/src/modules/liveball/liveball.service';

async function testAllStreams() {
  for (const matchId of ['1632348', '1640057', '1545827', '1638591']) {
    console.log(`\n--- Test match ${matchId} ---`);
    const stream = await resolveLiveBallStream(matchId, true);
    console.log('Résultat :', stream);
  }
}

testAllStreams().catch(console.error);
