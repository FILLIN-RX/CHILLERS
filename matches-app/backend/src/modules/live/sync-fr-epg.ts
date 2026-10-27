import '../../config/env';
import { importExternalEpg } from './epg.service';
import { getLiveDb } from './live.db';

async function main() {
  const result = await importExternalEpg();
  console.log(
    `[EPG] EPGShare FR1 : ${result.parsedPrograms} programme(s) parses, ` +
    `${result.associated}/${result.activeChannels} chaîne(s) associée(s), ` +
    `${result.imported} grille(s) importée(s), ${result.withNow} avec un programme en cours.`,
  );
  if (result.unmatched.length > 0) {
    console.log(`[EPG] Sans correspondance (${result.unmatched.length}) : ${result.unmatched.join(', ')}`);
  }
  if (result.ambiguous.length > 0) {
    for (const entry of result.ambiguous.slice(0, 20)) {
      console.log(`[EPG] Ambiguë : ${entry.name} → ${entry.candidates.join(' | ')}`);
    }
  }

  const conn = await getLiveDb();
  await conn.close();
}

main().catch(async (error) => {
  console.error('[EPG] Échec de l’import EPGShare:', error instanceof Error ? error.message : error);
  try {
    const conn = await getLiveDb();
    await conn.close();
  } catch {}
  process.exitCode = 1;
});
