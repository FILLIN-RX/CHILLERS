/**
 * Récupère les épisodes disponibles sur French-Manga (W16) pour les animes
 * déjà confirmés dans le catalogue TMDB. Les liens existants restent la source
 * principale; les liens W16 sont conservés dans `sources` et servent de lien
 * principal uniquement quand aucun lien d'épisode n'existe encore.
 *
 *   npx tsx src/modules/scraping/core/scrape-w16-animes.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../../../config/db';
import Serie from '../../../models/Serie';
import ProviderCatalogItem from '../../../models/ProviderCatalogItem';
import { fetchW16AnimePayload } from '../../catalog/w16-anime-source';

const DELAY_MS = Number(process.env.W16_SCRAPE_DELAY_MS || 350);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canonicalEpisode(n: number, season: number): string {
  return `S${String(season).padStart(2, '0')}E${String(n).padStart(2, '0')}`;
}

async function main() {
  await connectDB();
  const items = ProviderCatalogItem.find({
    provider: 'otaku',
    type: 'anime',
    active: true,
    matchStatus: 'matched',
    'card.media_type': 'tv',
    'card.genre_ids': 16,
  })
    .select('sourceId title year season pageUrl tmdbId language quality')
    .lean()
    .cursor();

  let processed = 0;
  let withEpisodes = 0;
  let linksAdded = 0;
  let failures = 0;

  for await (const item of items) {
    processed++;
    const payload = await fetchW16AnimePayload(item.sourceId);
    if (!payload) {
      failures++;
      await sleep(DELAY_MS);
      continue;
    }

    const season = Math.max(1, Number(item.season) || 1);
    const existing = await Serie.findOne({ tmdbId: item.tmdbId }).lean();
    if (!existing) {
      const titleCollision = await Serie.findOne({ titre: new RegExp(`^${escapeRegex(item.title)}$`, 'i') })
        .select('_id tmdbId')
        .lean();
      if (titleCollision && Number(titleCollision.tmdbId) !== Number(item.tmdbId)) {
        console.warn(`[W16 scrape] homonyme ignoré: « ${item.title} » est déjà associé à TMDB ${titleCollision.tmdbId}, pas ${item.tmdbId}`);
        await sleep(DELAY_MS);
        continue;
      }
    }
    const episodes = (existing?.episodes || []).map((episode: any) => ({
      ...episode,
      sources: [...(episode.sources || [])],
      providerPages: [...(episode.providerPages || [])],
    }));
    let itemAdded = 0;

    for (const [episodeKey, sourceEpisode] of Object.entries(payload.episodes)) {
      const episodeNumber = Number(episodeKey);
      if (!Number.isInteger(episodeNumber) || episodeNumber < 1 || sourceEpisode.links.length === 0) continue;

      const links = [...sourceEpisode.links].sort((a, b) =>
        (a.language === 'VF' ? 0 : 1) - (b.language === 'VF' ? 0 : 1)
      );
      const index = episodes.findIndex((episode: any) =>
        Number(episode.season) === season && Number(episode.episodeNumber) === episodeNumber
      );
      const page = {
        provider: 'w16',
        path: item.pageUrl,
        language: links[0].language,
        season,
        episode: episodeNumber,
        lastScrapedAt: new Date(),
        isWorking: true,
      };

      if (index === -1) {
        episodes.push({
          episode: canonicalEpisode(episodeNumber, season),
          season,
          episodeNumber,
          lien: links[0].url,
          langueAudio: links[0].language,
          source: 'w16',
          quality: item.quality,
          sources: links.map((link) => ({
            source: `w16-${link.language.toLowerCase()}-${link.host}`,
            url: link.url,
            langueAudio: link.language,
          })),
          providerPages: [page],
        });
        itemAdded += links.length;
        continue;
      }

      const episode: any = episodes[index];
      const knownUrls = new Set((episode.sources || []).map((source: any) => source.url));
      for (const link of links) {
        if (knownUrls.has(link.url)) continue;
        episode.sources.push({
          source: `w16-${link.language.toLowerCase()}-${link.host}`,
          url: link.url,
          langueAudio: link.language,
        });
        itemAdded++;
      }
      if (!episode.lien || episode.lien === '#') {
        episode.lien = links[0].url;
        episode.langueAudio = links[0].language;
        episode.source = 'w16';
      }
      if (!(episode.providerPages || []).some((entry: any) => entry.provider === 'w16' && entry.path === item.pageUrl)) {
        episode.providerPages.push(page);
      }
    }

    if (episodes.length > 0) {
      const title = existing?.titre || item.title;
      await Serie.findOneAndUpdate(
        { tmdbId: item.tmdbId },
        {
          $set: {
            titre: title,
            tmdbId: item.tmdbId,
            ...(existing?.year || item.year ? { year: existing?.year || item.year } : {}),
            ...(existing?.pageUrl ? {} : { pageUrl: item.pageUrl }),
            episodes,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      withEpisodes++;
      linksAdded += itemAdded;
    }

    if (processed % 50 === 0) {
      console.log(`[W16 scrape] traités=${processed} avec épisodes=${withEpisodes} liens ajoutés=${linksAdded} erreurs=${failures}`);
    }
    await sleep(DELAY_MS);
  }

  await mongoose.disconnect();
  console.log(`[W16 scrape] terminé: fiches=${processed}, avec épisodes=${withEpisodes}, nouveaux liens=${linksAdded}, erreurs=${failures}`);
}

main().catch(async (error) => {
  console.error('[FATAL] scrape-w16-animes:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
