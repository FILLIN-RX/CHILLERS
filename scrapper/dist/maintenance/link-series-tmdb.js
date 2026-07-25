"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const fs_1 = __importDefault(require("fs"));
const tmdb_1 = __importDefault(require("../config/tmdb"));
const db_1 = require("../config/db");
const Serie_1 = __importDefault(require("../models/Serie"));
const ERROR_LOG_PATH = path_1.default.join(__dirname, '../../tmdb-link-errors.log');
function parseTitre(titre) {
    const match = titre.match(/^(.*?)\s*[-–—:]\s*(?:Saison|Season)\s*(\d+)/i);
    if (!match)
        return null;
    return { seriesName: match[1].trim(), season: parseInt(match[2], 10) };
}
function normalize(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function nameSimilarity(a, b) {
    const wordsA = new Set(normalize(a).split(' ').filter(w => w.length > 1));
    const wordsB = new Set(normalize(b).split(' ').filter(w => w.length > 1));
    if (wordsA.size === 0 && wordsB.size === 0)
        return 1;
    let intersect = 0;
    for (const w of wordsA)
        if (wordsB.has(w))
            intersect++;
    const union = new Set([...wordsA, ...wordsB]).size;
    return intersect / union;
}
function extractEpisodeTitleFromFilename(filename) {
    const cleaned = filename
        .replace(/\.(?:mkv|mp4|avi|mov)$/i, '')
        .replace(/\.[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?$/g, '')
        .replace(/\.(?:1080p|720p|480p|2160p|WEB|BLURAY|BRRiP|WEBRiP|HDTV|x264|x265|H264|H265|MULTi|VFF|VOSTFR|FRENCH|TRUEFRENCH|SUPPLY|TyHD|GL0P|d4kid|AMZN|NF|iT|iTA|iNTERNAL|PROPER|REPACK)\..*/gi, '')
        .replace(/[._]/g, ' ')
        .trim();
    const seMatch = cleaned.match(/[sS]\d+[eE]\d+\s+(.+)/);
    if (seMatch) {
        const title = seMatch[1].trim();
        if (title && !/^(?:episode|épisode|ep)\s*\d+$/i.test(title) && title.length > 2) {
            return title;
        }
    }
    return null;
}
async function searchTmdb(query) {
    try {
        const { data } = await tmdb_1.default.get('/search/tv', {
            params: { query, page: 1 },
        });
        return data.results || [];
    }
    catch (err) {
        console.error(`[TMDB] Search error for "${query}":`, err.message);
        return [];
    }
}
async function getTvDetails(tmdbId) {
    try {
        const { data } = await tmdb_1.default.get(`/tv/${tmdbId}`);
        return data;
    }
    catch {
        return null;
    }
}
async function getSeasonDetails(tmdbId, seasonNumber) {
    try {
        const { data } = await tmdb_1.default.get(`/tv/${tmdbId}/season/${seasonNumber}`);
        return data;
    }
    catch {
        return null;
    }
}
async function main() {
    await (0, db_1.connectDB)();
    const allSeries = await Serie_1.default.find({ tmdbId: { $exists: false } })
        .select('titre episodes tmdbId')
        .lean();
    if (allSeries.length === 0) {
        console.log('Aucune série à lier (toutes ont déjà un tmdbId).');
        return;
    }
    const groups = new Map();
    for (const serie of allSeries) {
        const groupKey = serie.titre;
        if (!groups.has(groupKey)) {
            const epNumbers = serie.episodes.map(e => e.episodeNumber);
            const season = Math.min(...epNumbers);
            groups.set(groupKey, { entries: [], season, maxEpisode: 0 });
        }
        const group = groups.get(groupKey);
        group.entries.push(serie);
        const epNums = serie.episodes.map(e => e.episodeNumber);
        const hasRealNumbers = epNums.some(n => typeof n === 'number' && n > 0);
        const maxEp = hasRealNumbers
            ? Math.max(...epNums.filter((n) => typeof n === 'number'), 0)
            : serie.episodes.length;
        if (maxEp > group.maxEpisode)
            group.maxEpisode = maxEp;
    }
    let linked = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];
    for (const [titre, group] of groups) {
        const parsed = parseTitre(titre);
        if (!parsed) {
            errors.push(`[PARSE] Cannot parse titre: "${titre}"`);
            failed++;
            continue;
        }
        const { seriesName, season } = parsed;
        const uploadedCount = group.maxEpisode;
        console.log(`\n--- ${seriesName} S${season} (${uploadedCount} épisodes) ---`);
        const results = await searchTmdb(seriesName);
        if (results.length === 0) {
            errors.push(`[SEARCH] No TMDB results for "${seriesName}"`);
            failed++;
            continue;
        }
        let matched = false;
        for (let i = 0; i < Math.min(3, results.length); i++) {
            const candidate = results[i];
            console.log(`  Candidat ${i + 1}: "${candidate.name}" (id: ${candidate.id})`);
            const sim = nameSimilarity(seriesName, candidate.name);
            if (sim < 0.3) {
                console.log(`    ❌ Similarité: ${sim.toFixed(2)} — ignoré`);
                continue;
            }
            console.log(`    ✅ Similarité: ${sim.toFixed(2)}`);
            const details = await getTvDetails(candidate.id);
            if (!details) {
                console.log(`    → Impossible de récupérer les détails`);
                continue;
            }
            const seasons = details.seasons || [];
            const seasonExists = seasons.some((s) => s.season_number === season);
            if (!seasonExists) {
                console.log(`    → Saison ${season} introuvable`);
                continue;
            }
            console.log(`    ✅ Saison ${season} existe`);
            const seasonDetail = await getSeasonDetails(candidate.id, season);
            if (!seasonDetail) {
                console.log(`    → Impossible de récupérer les épisodes S${season}`);
                continue;
            }
            const tmdbEpisodes = seasonDetail.episodes || [];
            const tmdbCount = tmdbEpisodes.length;
            const uploadedEpTitles = [];
            for (const serie of group.entries) {
                for (const ep of serie.episodes) {
                    const filename = (ep.lien || '').split('/').pop()?.split('?')[0] || '';
                    uploadedEpTitles.push({ ep: ep.episodeNumber, title: extractEpisodeTitleFromFilename(filename) });
                }
            }
            const titleMatches = uploadedEpTitles.filter(u => {
                if (!u.title)
                    return false;
                const tmdbEp = tmdbEpisodes.find((te) => te.episode_number === u.ep);
                if (!tmdbEp || !tmdbEp.name)
                    return false;
                return nameSimilarity(u.title, tmdbEp.name) > 0.4;
            });
            if (titleMatches.length > 0) {
                console.log(`    ✅ Match par titres d'épisodes (ex: "${titleMatches[0].title}")`);
                const firstMatch = tmdbEpisodes.find((te) => te.episode_number === titleMatches[0].ep);
                console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
                await Serie_1.default.updateMany({ titre }, { $set: { tmdbId: candidate.id } });
                linked++;
                matched = true;
                break;
            }
            if (tmdbCount === uploadedCount) {
                console.log(`    ⚠ Nombre exact d'épisodes: ${tmdbCount}`);
                console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
                await Serie_1.default.updateMany({ titre }, { $set: { tmdbId: candidate.id } });
                linked++;
                matched = true;
                break;
            }
            if (uploadedCount <= tmdbCount) {
                const uploadedEpNumbers = new Set();
                for (const serie of group.entries) {
                    for (const ep of serie.episodes)
                        uploadedEpNumbers.add(ep.episodeNumber);
                }
                const tmdbEpNumbers = new Set(tmdbEpisodes.map((e) => e.episode_number));
                const anyNumMatch = [...uploadedEpNumbers].some(n => tmdbEpNumbers.has(n));
                if (anyNumMatch) {
                    console.log(`    ⚠ Match relâché: TMDB=${tmdbCount}, uploadés=${uploadedCount}`);
                    console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
                    await Serie_1.default.updateMany({ titre }, { $set: { tmdbId: candidate.id } });
                    linked++;
                    matched = true;
                    break;
                }
            }
            console.log(`    ❌ TMDB: ${tmdbCount} épisodes, uploadés: ${uploadedCount}`);
        }
        if (!matched) {
            errors.push(`[NO MATCH] ${seriesName} S${season} — ${uploadedCount} épisodes`);
            failed++;
        }
    }
    console.log(`\n=== RÉSULTAT ===`);
    console.log(`✅ Liés: ${linked}`);
    console.log(`⏭️  Déjà liés (ignorés): ${skipped}`);
    console.log(`❌ Échecs: ${failed}`);
    if (errors.length > 0) {
        const logContent = errors.join('\n') + '\n';
        fs_1.default.appendFileSync(ERROR_LOG_PATH, logContent + '\n', 'utf-8');
        console.log(`\nErreurs logguées dans tmdb-link-errors.log`);
    }
    process.exit(0);
}
main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
