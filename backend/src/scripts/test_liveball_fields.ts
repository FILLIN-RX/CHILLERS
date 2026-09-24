import { getLiveBallMatches } from '/home/ruxel/CHILLERS/backend/src/modules/liveball/liveball.service';

async function test() {
  const matches = await getLiveBallMatches();
  console.log('Total matchs récupérés:', matches ? matches.length : 0);
  if (matches && matches.length > 0) {
    console.log('Exemples de matchs :');
    matches.slice(0, 10).forEach((m, idx) => {
      console.log(` [${idx + 1}] ID: ${m.id} | ${m.home} vs ${m.away} | Statut: ${m.status} | Score: ${m.score || 'N/A'} | Minute: ${m.minute || 'N/A'}`);
    });
  }
}

test().catch(console.error);
