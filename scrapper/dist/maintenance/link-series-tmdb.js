"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkSeriesTmdb = linkSeriesTmdb;
const db_1 = require("../config/db");
const tmdb_1 = __importDefault(require("../config/tmdb"));
const Serie_1 = __importDefault(require("../models/Serie"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
async function linkSeriesTmdb() {
    await (0, db_1.connectDB)();
    const allSeries = await Serie_1.default.find({ tmdbId: { $eq: null } }).lean();
    if (allSeries.length === 0) {
        console.log('Aucune série à lier.');
        return;
    }
    let linked = 0;
    let failed = 0;
    const errors = [];
    for (const serie of allSeries) {
        const titre = serie.titre;
        const parsed = parseTitre(titre);
        if (!parsed) {
            errors.push(`[PARSE] Cannot parse titre: "${titre}"`);
            failed++;
            continue;
        }
        const { seriesName, season } = parsed;
        console.log(`\n--- ${seriesName} S${season} ---`);
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
                console.log(`    ❌ Similarité trop faible: ${sim.toFixed(2)} — ignoré`);
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
                console.log(`    → Saison ${season} introuvable sur TMDB`);
                continue;
            }
            console.log(`    ✅ Saison ${season} existe sur TMDB`);
            const seasonDetail = await getSeasonDetails(candidate.id, season);
            if (!seasonDetail) {
                console.log(`    → Impossible de récupérer les épisodes`);
                continue;
            }
            const tmdbEpisodes = seasonDetail.episodes || [];
            const tmdbCount = tmdbEpisodes.length;
            const uploadedCount = serie.episodes?.length || 0;
            if (tmdbCount === uploadedCount) {
                console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
                await Serie_1.default.updateOne({ _id: serie._id }, { $set: { tmdbId: candidate.id } });
                linked++;
                matched = true;
                break;
            }
            if (uploadedCount <= tmdbCount) {
                const uploadedEpNumbers = new Set((serie.episodes || []).map((e) => e.episodeNumber || 0));
                const tmdbEpNumbers = new Set(tmdbEpisodes.map((e) => e.episode_number));
                const anyNumMatch = [...uploadedEpNumbers].some(n => n > 0 && tmdbEpNumbers.has(n));
                if (anyNumMatch) {
                    console.log(`    ✅ LIEN RÉUSSI (relâché) → tmdbId=${candidate.id}`);
                    await Serie_1.default.updateOne({ _id: serie._id }, { $set: { tmdbId: candidate.id } });
                    linked++;
                    matched = true;
                    break;
                }
            }
            console.log(`    ❌ Nombre TMDB: ${tmdbCount}, uploadés: ${uploadedCount} — pas de match`);
        }
        if (!matched) {
            errors.push(`[NO MATCH] ${seriesName} S${season} — aucun candidat TMDB valide`);
            failed++;
        }
    }
    console.log(`\n=== RÉSULTAT ===`);
    console.log(`✅ Liés: ${linked}`);
    console.log(`❌ Échecs: ${failed}`);
    if (errors.length > 0) {
        const logContent = errors.join('\n') + '\n';
        fs_1.default.appendFileSync(ERROR_LOG_PATH, logContent + '\n', 'utf-8');
        console.log(`\nErreurs logguées dans tmdb-link-errors.log`);
    }
}
if (require.main === module) {
    linkSeriesTmdb().catch(err => console.error('[FATAL]', err));
}
