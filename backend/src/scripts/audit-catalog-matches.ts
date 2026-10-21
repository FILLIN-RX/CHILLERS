/**
 * Audit en lecture seule des liens ProviderCatalogItem -> TMDB.
 * Usage: npx tsx src/scripts/audit-catalog-matches.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import ProviderCatalogItem from '../models/ProviderCatalogItem';

function tokens(value: string): Set<string> {
  return new Set((value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1));
}

function titleSimilarity(a: string, b: string): number {
  const normalize = (value: string) => (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (normalize(a) && normalize(a) === normalize(b)) return 1;
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common++;
  return common / new Set([...left, ...right]).size;
}

function yearOf(card: any): number | null {
  const raw = card?.release_date || card?.first_air_date || '';
  const year = Number(String(raw).slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

async function main() {
  await connectDB();
  const docs = await ProviderCatalogItem.find({ matchStatus: 'matched', active: true })
    .select('provider type title year tmdbId matchMethod card')
    .lean();
  const byKind = await ProviderCatalogItem.aggregate([
    { $match: { matchStatus: 'matched', active: true } },
    { $group: { _id: { type: '$type', mediaType: '$card.media_type', method: '$matchMethod' }, count: { $sum: 1 } } },
    { $sort: { '_id.type': 1, '_id.mediaType': 1, '_id.method': 1 } },
  ]);

  const issues: Array<{ provider: string; type: string; title: string; tmdbId?: number; reasons: string[] }> = [];
  const identities = new Map<string, { rows: number; titles: Set<string> }>();
  const numericTypes = new Map<number, Set<string>>();

  for (const doc of docs as any[]) {
    const card = doc.card;
    const reasons: string[] = [];
    const mediaType = card?.media_type;
    if (!card?.id || card.id !== doc.tmdbId) reasons.push('tmdbId_card_incoherent');
    if (doc.type === 'movie' && mediaType !== 'movie') reasons.push('film_lie_a_autre_type');
    if (doc.type === 'tv' && mediaType !== 'tv') reasons.push('serie_liee_a_autre_type');
    if (doc.type === 'anime') {
      if (mediaType !== 'movie' && mediaType !== 'tv') reasons.push('type_tmdb_absent');
      if (!(card?.genre_ids || []).includes(16)) reasons.push('anime_sans_genre_animation');
    }

    const cardTitle = card?.title || card?.name || '';
    const originalTitle = card?.original_title || card?.original_name || '';
    const similarity = Math.max(titleSimilarity(doc.title, cardTitle), titleSimilarity(doc.title, originalTitle));
    if (similarity < 0.35) reasons.push(`titre_tres_different_${similarity.toFixed(2)}`);

    const sourceYear = doc.year ? Number(doc.year) : null;
    const tmdbYear = yearOf(card);
    if (sourceYear && tmdbYear && Math.abs(sourceYear - tmdbYear) > 1) {
      reasons.push(`annee_differente_${sourceYear}_${tmdbYear}`);
    }

    if (reasons.length) {
      issues.push({ provider: doc.provider, type: doc.type, title: doc.title, tmdbId: doc.tmdbId, reasons });
    }

    if (doc.tmdbId && mediaType) {
      const identity = `${mediaType}:${doc.tmdbId}`;
      const entry = identities.get(identity) || { rows: 0, titles: new Set<string>() };
      entry.rows++;
      entry.titles.add(`${doc.title} (${sourceYear || '?'})`);
      identities.set(identity, entry);
      const types = numericTypes.get(doc.tmdbId) || new Set<string>();
      types.add(mediaType);
      numericTypes.set(doc.tmdbId, types);
    }
  }

  const sharedSameType = [...identities.entries()].filter(([, value]) => value.rows > 1).length;
  const numericIdCrossType = [...numericTypes.values()].filter((types) => types.size > 1).length;
  const reasonCounts = new Map<string, number>();
  for (const issue of issues) {
    for (const reason of issue.reasons) {
      const key = reason.replace(/_\d+(?:\.\d+)?/g, '_#');
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
    }
  }
  console.log(`[CatalogAudit] matched=${docs.length} issues=${issues.length}`);
  console.log(`[CatalogAudit] même œuvre listée par plusieurs entrées=${sharedSameType}`);
  console.log(`[CatalogAudit] même nombre TMDB réutilisé entre movie/tv=${numericIdCrossType} (normal : espaces TMDB distincts)`);
  console.log(`[CatalogAudit] type de catalogue / type TMDB / méthode=${JSON.stringify(byKind.map((row: any) => ({ ...row._id, count: row.count })))}`);
  console.log(`[CatalogAudit] types de suspicion=${JSON.stringify(Object.fromEntries(reasonCounts))}`);
  for (const issue of issues.slice(0, 100)) {
    const doc = (docs as any[]).find((row) => String(row.tmdbId) === String(issue.tmdbId) && row.title === issue.title && row.type === issue.type && row.provider === issue.provider);
    const card = doc?.card;
    console.log(`  ${issue.provider}/${issue.type}/${doc?.matchMethod || '?'}: "${issue.title}" (${doc?.year || '?'}) -> ${issue.tmdbId ?? '?'} card=${card?.id ?? '?'}:${card?.media_type ?? '?'} "${card?.title || card?.name || '?'}" (${yearOf(card) || '?'}) [${issue.reasons.join(', ')}]`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('[CatalogAudit] failed:', error?.message || error);
  process.exit(1);
});
