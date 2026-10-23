import '../../config/env';
import { syncOhaCatalogChannels } from './oha-catalog.service';
import { getLiveDb } from './live.db';

async function main() {
  const result = await syncOhaCatalogChannels();
  console.log(`[OHA] ${result.synced} chaîne(s) enregistrée(s) dans Mongo à ${result.syncedAt}`);
  const conn = await getLiveDb();
  await conn.close();
}

main().catch(async (error) => {
  console.error('[OHA] Échec de synchronisation:', error instanceof Error ? error.message : error);
  try {
    const conn = await getLiveDb();
    await conn.close();
  } catch {}
  process.exitCode = 1;
});
