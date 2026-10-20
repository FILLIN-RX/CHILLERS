import ProviderCatalogItem, {
  CatalogItemType,
  CatalogProvider,
  normalizeCatalogTitle,
} from '../../models/ProviderCatalogItem';

export interface CatalogUpsertInput {
  provider: CatalogProvider;
  sourceId: string;
  type: CatalogItemType;
  title: string;
  year?: number;
  season?: number;
  pageUrl: string;
  posterUrl?: string;
  language?: string;
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
 * Upsert incrémental d'un item de listing. Un item déjà connu a juste son
 * lastSeenAt rafraîchi (missingCount remis à 0, active réactivé) ; un item
 * nouveau est créé en `pending` — le matching TMDB viendra plus tard.
 */
export async function upsertCatalogItem(input: CatalogUpsertInput, stats: SyncRunStats): Promise<void> {
  const now = new Date();
  const existing = await ProviderCatalogItem.findOne({
    provider: input.provider,
    sourceId: input.sourceId,
  })
    .select('_id matchStatus tmdbId')
    .lean();

  if (existing) {
    await ProviderCatalogItem.updateOne(
      { _id: existing._id },
      {
        $set: {
          title: input.title,
          normalizedTitle: normalizeCatalogTitle(input.title),
          pageUrl: input.pageUrl,
          ...(input.year ? { year: input.year } : {}),
          ...(input.season ? { season: input.season } : {}),
          ...(input.posterUrl ? { posterUrl: input.posterUrl } : {}),
          ...(input.language ? { language: input.language } : {}),
          ...(input.quality ? { quality: input.quality } : {}),
          lastSeenAt: now,
          missingCount: 0,
          active: true,
        },
      }
    );
    stats.updated++;
  } else {
    await ProviderCatalogItem.create({
      provider: input.provider,
      sourceId: input.sourceId,
      type: input.type,
      title: input.title,
      normalizedTitle: normalizeCatalogTitle(input.title),
      year: input.year,
      season: input.season,
      pageUrl: input.pageUrl,
      posterUrl: input.posterUrl,
      language: input.language,
      quality: input.quality,
      matchStatus: 'pending',
      active: true,
      firstSeenAt: now,
      lastSeenAt: now,
      missingCount: 0,
    });
    stats.created++;
  }
  stats.seen++;
}

/**
 * À la fin d'un run : incrémente missingCount sur les items du provider non
 * vus pendant ce run. Au-delà de 3 runs manquants, l'est marqué inactif
 * (retiré de l'index d'affichage mais conservé en base).
 */
export async function markMissingAfterRun(stats: SyncRunStats): Promise<number> {
  const missing = await ProviderCatalogItem.updateMany(
    { provider: stats.provider, lastSeenAt: { $lt: stats.runStart }, active: true },
    { $inc: { missingCount: 1 } }
  );

  // Désactive ceux qui cumulent 3 absences consécutives.
  await ProviderCatalogItem.updateMany(
    { provider: stats.provider, active: true, missingCount: { $gte: 3 } },
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
