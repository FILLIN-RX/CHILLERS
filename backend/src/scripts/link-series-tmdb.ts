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

// Normalize a string for comparison: lowercase, remove accents, keep alphanum
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaccard similarity between two name strings
function nameSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter(w => w.length > 1));
  const wordsB = new Set(normalize(b).split(' ').filter(w => w.length > 1));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  let intersect = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersect++;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersect / union;
}

// Extract episode title from a Doodstream lien URL filename
// Patterns: "Series.Name.S01E01.EpisodeTitle.1080p.WEB.mkv"
function extractEpisodeTitleFromFilename(filename: string): string | null {
  // Remove quality/codec tags
  const cleaned = filename
    .replace(/\.(?:mkv|mp4|avi|mov)$/i, '')
    .replace(/\.[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?$/g, '')
    .replace(/\.(?:1080p|720p|480p|2160p|WEB|BLURAY|BRRiP|WEBRiP|HDTV|x264|x265|H264|H265|MULTi|VFF|VOSTFR|FRENCH|TRUEFRENCH|SUPPLY|TyHD|GL0P|d4kid|AMZN|NF|iT|iTA|iNTERNAL|PROPER|REPACK)\..*/gi, '')
    .replace(/[._]/g, ' ')
    .trim();

  // Try to extract after SXXEYY pattern
  const seMatch = cleaned.match(/[sS]\d+[eE]\d+\s+(.+)/);
  if (seMatch) {
    const title = seMatch[1].trim();
    // Filter out generic titles like "Episode 1" or "Épisode 1"
    if (title && !/^(?:episode|épisode|ep)\s*\d+$/i.test(title) && title.length > 2) {
      return title;
    }
  }

  return null;
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

      // Step 0: check name similarity to avoid false positives
      const sim = nameSimilarity(seriesName, candidate.name);
      if (sim < 0.3) {
        console.log(`    ❌ Similarité de nom trop faible: ${sim.toFixed(2)} — ignoré`);
        continue;
      }
      console.log(`    ✅ Similarité de nom: ${sim.toFixed(2)}`);

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

      // Step 2: get TMDB season episodes
      const seasonDetail = await getSeasonDetails(candidate.id, season);
      if (!seasonDetail) {
        console.log(`    → Impossible de récupérer les épisodes de la saison ${season}`);
        continue;
      }

      const tmdbEpisodes = seasonDetail.episodes || [];
      const tmdbCount = tmdbEpisodes.length;

      // Step 3: check by episode titles (most reliable)
      const uploadedEpTitles: { ep: number; title: string | null }[] = group.entries.map(e => {
        const filename = (e.lien || '').split('/').pop()?.split('?')[0] || '';
        return { ep: e.episode, title: extractEpisodeTitleFromFilename(filename) };
      });
      const titleMatches = uploadedEpTitles.filter(u => {
        if (!u.title) return false;
        const tmdbEp = tmdbEpisodes.find((te: any) => te.episode_number === u.ep);
        if (!tmdbEp || !tmdbEp.name) return false;
        const epSim = nameSimilarity(u.title, tmdbEp.name);
        return epSim > 0.4;
      });

      if (titleMatches.length > 0) {
        console.log(`    ✅ Match par titres d'épisodes: ${titleMatches.length} correspondance(s) (ex: "${titleMatches[0].title}" ≈ TMDB "${tmdbEpisodes.find((te: any) => te.episode_number === titleMatches[0].ep)?.name}")`);
        console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
        for (const entry of group.entries) {
          entry.tmdbId = candidate.id;
        }
        linked++;
        matched = true;
        break;
      }

      // Step 4: strict match by exact episode count (fallback)
      if (tmdbCount === uploadedCount) {
        console.log(`    ⚠ Nombre d'épisodes exact: ${tmdbCount} — lien par décompte (nom validé: ${sim.toFixed(2)})`);
        console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
        for (const entry of group.entries) {
          entry.tmdbId = candidate.id;
        }
        linked++;
        matched = true;
        break;
      }

      // Step 5: relaxed match — uploaded <= TMDB + episode numbers overlap + name validated
      if (uploadedCount <= tmdbCount) {
        const uploadedEpNumbers = new Set(group.entries.map(e => e.episode));
        const tmdbEpNumbers = new Set(tmdbEpisodes.map((e: any) => e.episode_number));
        const anyNumMatch = [...uploadedEpNumbers].some(n => tmdbEpNumbers.has(n));

        if (anyNumMatch) {
          console.log(`    ⚠ Nombre d'épisodes TMDB: ${tmdbCount}, uploadés: ${uploadedCount} — match relâché par numéros (nom validé: ${sim.toFixed(2)})`);
          console.log(`    ✅ LIEN RÉUSSI (relâché) → tmdbId=${candidate.id}`);
          for (const entry of group.entries) {
            entry.tmdbId = candidate.id;
          }
          linked++;
          matched = true;
          break;
        }
      }

      console.log(`    ❌ Nombre d'épisodes TMDB: ${tmdbCount}, uploadés: ${uploadedCount} — pas de match`);
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
