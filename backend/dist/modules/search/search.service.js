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
// p-limit n'est pas une dépendance du backend — on évite un nouveau package.
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
 * Recherche multi-source :
 *  1. MongoDB local (films + séries, regex insensible à la casse, max 5 chacun)
 *  2. TMDB /search/movie + /search/tv en parallèle (sépare les personnes)
 *  3. Hydratation des top-8 de chaque côté avec append_to_response=images,credits,videos
 *     (c'est ce qui donne les posters/casts/trailers réels — /search/multi les strip)
 *
 * Retourne une forme stable consommable par le frontend :
 *   { localResults: { movies, series }, tmdbResults: { results: [...] } }
 * Chaque résultat TMDB est taggé media_type ∈ 'movie' | 'tv' (plus de 'person').
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
    const movieTop = (moviesResp.results || []).slice(0, 8);
    const tvTop = (tvResp.results || []).slice(0, 8);
    const [movieDetails, tvDetails] = await Promise.all([
        Promise.all(movieTop.map(m => fetchDetails('movie', m.id, language))),
        Promise.all(tvTop.map(t => fetchDetails('tv', t.id, language))),
    ]);
    // Merge : le résultat de base (list) fournit les champs de ranking,
    // le détail hydraté fournit poster/overview/cast/trailer.
    const tmdbResults = {
        results: [
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
        ],
    };
    return {
        localResults: { movies: localMovies, series: localSeries },
        tmdbResults,
    };
};
exports.searchMulti = searchMulti;
