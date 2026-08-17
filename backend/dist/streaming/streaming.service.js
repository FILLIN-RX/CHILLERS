"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEpisodeStream = exports.getMovieStream = void 0;
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
