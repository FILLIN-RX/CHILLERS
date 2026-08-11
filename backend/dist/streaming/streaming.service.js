"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEpisodeStreamFast = exports.getMovieStreamFast = exports.getEpisodeStream = exports.getMovieStream = void 0;
const provider_manager_1 = require("./provider-manager");
const manager = new provider_manager_1.ProviderManager();
const getMovieStream = async (query) => {
    return manager.getMovieStream(query);
};
exports.getMovieStream = getMovieStream;
const getEpisodeStream = async (query) => {
    return manager.getEpisodeStream(query);
};
exports.getEpisodeStream = getEpisodeStream;
// Variantes "rapides" (endpoint secondaire /api/nexstream) : uniquement les
// providers locaux (base de données), sans les fournisseurs lents (doodstream,
// otaku, torrents). Utilisées par la course Phase 5 du lecteur.
const getMovieStreamFast = async (query) => {
    return manager.getMovieStream(query, { only: ['direct', 'mongodb'] });
};
exports.getMovieStreamFast = getMovieStreamFast;
const getEpisodeStreamFast = async (query) => {
    return manager.getEpisodeStream(query, { only: ['direct', 'mongodb'] });
};
exports.getEpisodeStreamFast = getEpisodeStreamFast;
