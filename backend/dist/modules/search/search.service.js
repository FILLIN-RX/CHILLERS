"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMulti = void 0;
const tmdb_1 = __importDefault(require("../../config/tmdb"));
const language_1 = require("../../config/language");
const Movie_1 = __importDefault(require("../../models/Movie"));
const Serie_1 = __importDefault(require("../../models/Serie"));
// Petit limiteur de concurrence maison (équivalent p-limit avec une cap à 4).
const queue = [];
let active = 0;
const MAX = 4;
function limit(fn) {
    return new Promise((resolve, reject) => {
        const run = () => {
            active++;
            fn()
                .then(resolve, reject)
                .finally(() => {
                active--;
                const next = queue.shift();
                if (next)
                    next();
            });
        };
        if (active < MAX)
            run();
        else
            queue.push(run);
    });
}
async function fetchDetails(media_type, id, language) {
    return limit(() => tmdb_1.default
        .get(`/${media_type}/${id}`, {
        params: {
            append_to_response: 'images,credits,videos',
            include_image_language: 'en,fr,null',
            language: (0, language_1.toTMDBLanguage)(language),
        },
    })
        .then(r => r.data)
        .catch(() => null));
}
/**
 * Normalise un titre pour la comparaison (enlève articles, ponctuation, etc.)
 */
function normalizeTitle(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/^(the|le|la|les|un|une|des)\s+/i, '') // Retire articles
        .replace(/[^\w\s]/g, '') // Retire ponctuation
        .replace(/\s+/g, ' ') // Normalise espaces
        .trim();
}
/**
 * Calcule un score de similarité entre le titre recherché et le résultat
 */
function calculateRelevanceScore(query, result, mediaType) {
    const title = mediaType === 'movie' ? result.title || result.name : result.name || result.title;
    const originalTitle = result.original_title || result.original_name || '';
    const normalizedQuery = normalizeTitle(query);
    const normalizedTitle = normalizeTitle(title || '');
    const normalizedOriginal = normalizeTitle(originalTitle);
    let score = 0;
    // Correspondance exacte = 100 points
    if (normalizedTitle === normalizedQuery || normalizedOriginal === normalizedQuery) {
        score += 100;
    }
    // Commence par la requête = 50 points
    else if (normalizedTitle.startsWith(normalizedQuery) || normalizedOriginal.startsWith(normalizedQuery)) {
        score += 50;
    }
    // Contient la requête = 25 points
    else if (normalizedTitle.includes(normalizedQuery) || normalizedOriginal.includes(normalizedQuery)) {
        score += 25;
    }
    // Bonus pour popularité (vote_average et vote_count)
    const voteAverage = result.vote_average || 0;
    const voteCount = result.vote_count || 0;
    score += (voteAverage / 10) * 20; // Max 20 points
    score += Math.min(voteCount / 100, 10); // Max 10 points
    // Bonus pour année récente (les plus récents = plus pertinents)
    const year = parseInt((result.release_date || result.first_air_date || '').substring(0, 4));
    if (year >= 2020)
        score += 10;
    else if (year >= 2010)
        score += 5;
    return score;
}
/**
 * Filtre les doublons et variantes en gardant le meilleur résultat par titre normalisé
 */
function deduplicateResults(results, query) {
    const seen = new Map();
    for (const result of results) {
        const mediaType = result.media_type;
        const title = mediaType === 'movie'
            ? result.title || result.name
            : result.name || result.title;
        const normalized = normalizeTitle(title || '');
        const score = calculateRelevanceScore(query, result, mediaType);
        // Garde seulement le résultat avec le meilleur score pour chaque titre normalisé
        if (!seen.has(normalized) || score > seen.get(normalized).score) {
            seen.set(normalized, { ...result, score });
        }
    }
    // Trie par score décroissant et retourne
    return Array.from(seen.values())
        .sort((a, b) => b.score - a.score)
        .map(({ score, ...rest }) => rest); // Retire le score du résultat final
}
/**
 * Recherche multi-source avec déduplication intelligente :
 *  1. MongoDB local (films + séries, regex insensible à la casse)
 *  2. TMDB /search/movie + /search/tv en parallèle
 *  3. Hydratation des tops avec append_to_response=images,credits,videos
 *  4. Déduplication par titre normalisé avec scoring de pertinence
 *  5. Retour des résultats triés par pertinence
 */
const searchMulti = async (query, page = 1, language) => {
    const regex = new RegExp(query, 'i');
    const [localMovies, localSeries, moviesResp, tvResp] = await Promise.all([
        Movie_1.default.find({ titre: regex }).limit(5).lean().catch(() => []),
        Serie_1.default.find({ titre: regex }).limit(5).lean().catch(() => []),
        tmdb_1.default
            .get('/search/movie', { params: { query, page, language: (0, language_1.toTMDBLanguage)(language) } })
            .then(r => r.data)
            .catch(() => ({ results: [] })),
        tmdb_1.default
            .get('/search/tv', { params: { query, page, language: (0, language_1.toTMDBLanguage)(language) } })
            .then(r => r.data)
            .catch(() => ({ results: [] })),
    ]);
    const movieTop = (moviesResp.results || []).slice(0, 20); // Augmenté pour meilleur filtrage
    const tvTop = (tvResp.results || []).slice(0, 20);
    const [movieDetails, tvDetails] = await Promise.all([
        Promise.all(movieTop.map(m => fetchDetails('movie', m.id, language))),
        Promise.all(tvTop.map(t => fetchDetails('tv', t.id, language))),
    ]);
    // Merge les résultats
    const allResults = [
        ...movieTop.map((m, i) => ({
            ...(movieDetails[i] || {}),
            ...m,
            media_type: 'movie',
        })),
        ...tvTop.map((t, i) => ({
            ...(tvDetails[i] || {}),
            ...t,
            media_type: 'tv',
        })),
    ];
    // Déduplique et trie par pertinence
    const deduplicatedResults = deduplicateResults(allResults, query);
    // Limite à 15 résultats les plus pertinents
    const tmdbResults = {
        results: deduplicatedResults.slice(0, 15),
    };
    return {
        localResults: { movies: localMovies, series: localSeries },
        tmdbResults,
    };
};
exports.searchMulti = searchMulti;
