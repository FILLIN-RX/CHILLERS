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
const Movie_1 = __importDefault(require("../models/Movie"));
const ERROR_LOG_PATH = path_1.default.join(__dirname, '../../tmdb-movie-link-errors.log');
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
async function searchTmdbMovie(query, year) {
    try {
        const params = { query, page: 1 };
        if (year)
            params.year = year;
        const { data } = await tmdb_1.default.get('/search/movie', { params });
        return data.results || [];
    }
    catch (err) {
        console.error(`[TMDB] Search error for "${query}":`, err.message);
        return [];
    }
}
async function main() {
    await (0, db_1.connectDB)();
    const toLink = await Movie_1.default.find({ tmdbId: { $exists: false } })
        .select('titre lien tmdbId createdAt year')
        .lean();
    if (toLink.length === 0) {
        console.log('Aucun film à lier (tous ont déjà un tmdbId).');
        return;
    }
    console.log(`${toLink.length} films sans TMDB à traiter\n`);
    let linked = 0;
    let failed = 0;
    const errors = [];
    const total = toLink.length;
    for (let idx = 0; idx < total; idx++) {
        const movie = toLink[idx];
        const title = movie.titre;
        console.log(`[${idx + 1}/${total}] "${title}"${movie.year ? ` (${movie.year})` : ''}`);
        const results = await searchTmdbMovie(title, movie.year);
        if (results.length === 0) {
            errors.push(`[SEARCH] No TMDB results for "${title}"`);
            failed++;
            continue;
        }
        let matched = false;
        for (let i = 0; i < Math.min(3, results.length); i++) {
            const candidate = results[i];
            const candidateTitle = candidate.title || candidate.name || '';
            const candidateYear = candidate.release_date
                ? new Date(candidate.release_date).getFullYear()
                : null;
            console.log(`  Candidat ${i + 1}: "${candidateTitle}" (id: ${candidate.id})${candidateYear ? ` (${candidateYear})` : ''}`);
            const sim = nameSimilarity(title, candidateTitle);
            if (sim < 0.3) {
                console.log(`    ❌ Similarité: ${sim.toFixed(2)} — ignoré`);
                continue;
            }
            console.log(`    ✅ Similarité: ${sim.toFixed(2)}`);
            if (movie.year && candidateYear && Math.abs(movie.year - candidateYear) > 1) {
                console.log(`    ❌ Année écart: ${movie.year} vs ${candidateYear} — ignoré`);
                continue;
            }
            if (sim >= 0.5 || (sim >= 0.3 && i === 0)) {
                console.log(`    ✅ LIEN RÉUSSI → tmdbId=${candidate.id}`);
                await Movie_1.default.updateOne({ _id: movie._id }, { $set: { tmdbId: candidate.id } });
                linked++;
                matched = true;
                break;
            }
        }
        if (!matched) {
            errors.push(`[NO MATCH] "${title}" — aucun candidat TMDB valide`);
            failed++;
        }
    }
    console.log(`\n=== RÉSULTAT ===`);
    console.log(`✅ Liés: ${linked}`);
    console.log(`❌ Échecs: ${failed}`);
    console.log(`📊 Total traités: ${total}`);
    if (errors.length > 0) {
        const logContent = errors.join('\n') + '\n';
        fs_1.default.appendFileSync(ERROR_LOG_PATH, logContent + '\n', 'utf-8');
        console.log(`\nErreurs logguées dans tmdb-movie-link-errors.log`);
    }
}
main().catch(err => console.error('[FATAL]', err));
