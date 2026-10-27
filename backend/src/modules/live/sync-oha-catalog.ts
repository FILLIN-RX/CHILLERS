import '../../config/env';
import {
  revalidateOhaCatalogStreams,
  syncOhaCatalogChannels,
} from './oha-catalog.service';
import { refreshOhaEpg } from './epg.service';
import { getLiveDb } from './live.db';

async function main() {
  if (process.argv.includes('--epg')) {
    const result = await refreshOhaEpg();
    console.log(
      `[OHA] EPG now/next : ${result.withNow}/${result.checked} chaîne(s) avec programme en cours à ${result.updatedAt}`,
    );
    const conn = await getLiveDb();
    await conn.close();
    return;
  }

  const revalidate = process.argv.includes('--revalidate');
  const result = revalidate
    ? await revalidateOhaCatalogStreams()
    : await syncOhaCatalogChannels();

  if ('synced' in result) {
    console.log(
      `[OHA] ${result.synced} chaîne(s), ${result.resolved} flux vivant(s), ` +
      `${result.deactivated} désactivée(s) à ${result.syncedAt}`,
    );
  } else {
    console.log(
      `[OHA] Revalidation : ${result.checked} vérifiée(s), ${result.resolved} flux vivant(s), ` +
      `${result.deactivated} désactivée(s) à ${result.revalidatedAt}`,
    );
  }

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
