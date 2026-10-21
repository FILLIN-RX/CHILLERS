import ProviderCatalogItem, {
  CatalogItemType,
  CatalogMatchStatus,
  CatalogProvider,
  normalizeCatalogTitle,
} from '../../models/ProviderCatalogItem';

export interface CatalogUpsertInput {
  provider: CatalogProvider;
  sourceId: string;
  type: CatalogItemType;
  title: string;
  year?: number;
  description?: string;
  season?: number;
  pageUrl: string;
  posterUrl?: string;
  language?: string;
  country?: string;
  quality?: string;
}

export interface SyncRunStats {
  provider: CatalogProvider;
  runStart: Date;
  seen: number;
  created: number;
  updated: number;
  pagesFetched: number;
}

export function newSyncRun(provider: CatalogProvider): SyncRunStats {
  return { provider, runStart: new Date(), seen: 0, created: 0, updated: 0, pagesFetched: 0 };
}

/**
 * Upsert d'un lot de listing en UN seul aller-retour.
 *
 * Atlas répond ici en ~2,3 s par opération : à 18 cartes × 2 round trips, une
 * page coûtait ~11 s et l'inventaire complet (~1 200 pages) partait pour 4 h.
 * Un bulkWrite par page ramène ça au temps du fetch.
 */
export async function upsertCatalogItems(
  inputs: CatalogUpsertInput[],
  stats: SyncRunStats
): Promise<void> {
  if (inputs.length === 0) return;
  const now = new Date();

  const ops = inputs.map((input) => {
    const fields = {
      title: input.title,
      normalizedTitle: normalizeCatalogTitle(input.title),
      pageUrl: input.pageUrl,
      ...(input.year ? { year: input.year } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.season ? { season: input.season } : {}),
      ...(input.posterUrl ? { posterUrl: input.posterUrl } : {}),
      ...(input.language ? { language: input.language } : {}),
      ...(input.country ? { country: input.country } : {}),
      ...(input.quality ? { quality: input.quality } : {}),
    };
    return {
      updateOne: {
        filter: { provider: input.provider, sourceId: input.sourceId },
        update: {
          $set: { ...fields, lastSeenAt: now, missingCount: 0, active: true },
          $setOnInsert: {
            type: input.type,
            matchStatus: 'pending' as CatalogMatchStatus,
            firstSeenAt: now,
          },
        },
        upsert: true,
      },
    };
  });

  const res = await ProviderCatalogItem.bulkWrite(ops, { ordered: false });
  stats.created += res.upsertedCount || 0;
  stats.updated += res.modifiedCount || 0;
  stats.seen += inputs.length;
}

/** Upsert d'un item isolé — même écriture que le lot. */
export async function upsertCatalogItem(input: CatalogUpsertInput, stats: SyncRunStats): Promise<void> {
  return upsertCatalogItems([input], stats);
}

/**
 * À la fin d'un pass : incrémente missingCount sur les items de CE type de
 * listing non vus pendant ce pass. Sans la borne `type`, le pass films
 * compterait absente toute l'archive séries à chaque nuit, et le 3e run la
 * désactiverait entièrement. Au-delà de 3 absences, l'item sort de l'index
 * d'affichage mais reste en base.
 */
export async function markMissingAfterRun(
  stats: SyncRunStats,
  type: CatalogItemType
): Promise<number> {
  const missing = await ProviderCatalogItem.updateMany(
    { provider: stats.provider, type, lastSeenAt: { $lt: stats.runStart }, active: true },
    { $inc: { missingCount: 1 } }
  );

  // Désactive ceux qui cumulent 3 absences consécutives.
  await ProviderCatalogItem.updateMany(
    { provider: stats.provider, type, active: true, missingCount: { $gte: 3 } },
    { $set: { active: false } }
  );

  return missing.modifiedCount || 0;
}

export function logSyncStats(stats: SyncRunStats, missing: number): void {
  console.log(
    `[CatalogSync:${stats.provider}] pages=${stats.pagesFetched} vus=${stats.seen} ` +
      `créés=${stats.created} mis à jour=${stats.updated} manquants=${missing}`
  );
}
