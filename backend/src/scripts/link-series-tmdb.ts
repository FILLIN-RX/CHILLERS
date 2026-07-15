import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import fs from 'fs';
import tmdbClient from '../config/tmdb';

const SERIES_OUTPUT_PATH = path.join(__dirname, '../../series-output.json');
const ERROR_LOG_PATH = path.join(__dirname, '../../tmdb-link-errors.log');

function parseTitre(titre: string): { seriesName: string; season: number } | null {
  const match = titre.match(/^(.*?)\s*[-–—:]\s*(?:Saison|Season)\s*(\d+)/i);
  if (!match) return null;
  return { seriesName: match[1].trim(), season: parseInt(match[2], 10) };
}

interface SeriesEntry {
  titre: string;
  season: number;
  episode: number;
  fileCode: string;
  [key: string]: any;
}

interface SeriesGroup {
  entries: SeriesEntry[];
  season: number;
  maxEpisode: number;
}

async function searchTmdb(query: string): Promise<any[]> {
  try {
    const { data } = await tmdbClient.get('/search/tv', {
      params: { query, page: 1 },
    });
    return data.results || [];
  } catch (err: any) {
    console.error(`[TMDB] Search error for "${query}":`, err.message);
    return [];
  }
}

async function getTvDetails(tmdbId: number): Promise<any | null> {
  try {
    const { data } = await tmdbClient.get(`/tv/${tmdbId}`);
    return data;
  } catch {
    return null;
  }
}

async function getSeasonDetails(tmdbId: number, seasonNumber: number): Promise<any | null> {
  try {
    const { data } = await tmdbClient.get(`/tv/${tmdbId}/season/${seasonNumber}`);
    return data;
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(SERIES_OUTPUT_PATH)) {
    console.error('series-output.json not found');
    process.exit(1);
  }

  const raw: Record<string, SeriesEntry> = JSON.parse(
    fs.readFileSync(SERIES_OUTPUT_PATH, 'utf-8')
  );

  // Group entries by titre
  const groups = new Map<string, SeriesGroup>();
  for (const [key, entry] of Object.entries(raw)) {
    const groupKey = entry.titre;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { entries: [], season: entry.season, maxEpisode: 0 });
    }
    const group = groups.get(groupKey)!;
    group.entries.push(entry);
    if (entry.episode > group.maxEpisode) group.maxEpisode = entry.episode;
  }

  let linked = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const [titre, group] of groups) {
    // Skip if all entries already have tmdbId
    const allHaveTmdb = group.entries.every(e => e.tmdbId);
    if (allHaveTmdb) {
      skipped++;
      continue;
    }

    const parsed = parseTitre(titre);
    if (!parsed) {
      errors.push(`[PARSE] Cannot parse titre: "${titre}"`);
      failed++;
      continue;
    }

    const { seriesName, season } = parsed;
    const uploadedCount = group.maxEpisode;
    console.log(`\n--- ${seriesName} S${season} (${uploadedCount} épisodes uploadés) ---`);

    const results = await searchTmdb(seriesName);
    if (results.length === 0) {
      errors.push(`[SEARCH] No TMDB results for "${seriesName}"`);
      failed++;
      continue;
    }

    let matched = false;
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const candidate = results[i];
      console.log(`  Candidat ${i + 1}: "${candidate.name}" (id: ${candidate.id}, popularité: ${candidate.popularity})`);

      // Step 1: check if season exists
      const details = await getTvDetails(candidate.id);
      if (!details) {
        console.log(`    → Impossible de récupérer les détails`);
        continue;
      }

      const seasons = details.seasons || [];
      const seasonExists = seasons.some((s: any) => s.season_number === season);
      if (!seasonExists) {
        console.log(`    → Saison ${season} introuvable dans les saisons TMDB`);
        continue;
      }
      console.log(`    ✅ Saison ${season} existe sur TMDB`);

      // Step 2: check exact episode count
      const seasonDetail = await getSeasonDetails(candidate.id, season);
      if (!seasonDetail) {
        console.log(`    → Impossible de récupérer les épisodes de la saison ${season}`);
        continue;
      }

      const tmdbEpisodes = seasonDetail.episodes || [];
      const tmdbCount = tmdbEpisodes.length;
      if (tmdbCount !== uploadedCount) {
        console.log(`    ❌ Nombre d'épisodes TMDB: ${tmdbCount}, uploadés: ${uploadedCount} — pas de match`);
        continue;
      }
      console.log(`    ✅ Nombre d'épisodes exact: ${tmdbCount}`);

      // Match found!
      console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
      for (const entry of group.entries) {
        entry.tmdbId = candidate.id;
      }
      linked++;
      matched = true;
      break;
    }

    if (!matched) {
      errors.push(`[NO MATCH] ${seriesName} S${season} — ${uploadedCount} épisodes uploadés, aucun candidat TMDB valide`);
      failed++;
    }
  }

  // Write updated series-output.json
  fs.writeFileSync(SERIES_OUTPUT_PATH, JSON.stringify(raw, null, 2), 'utf-8');
  console.log(`\n=== RÉSULTAT ===`);
  console.log(`✅ Liés: ${linked}`);
  console.log(`⏭️  Déjà liés (ignorés): ${skipped}`);
  console.log(`❌ Échecs: ${failed}`);

  if (errors.length > 0) {
    const logContent = errors.join('\n') + '\n';
    fs.appendFileSync(ERROR_LOG_PATH, logContent + '\n', 'utf-8');
    console.log(`\nErreurs logguées dans tmdb-link-errors.log`);
  }
}

main().catch(err => console.error('[FATAL]', err));
