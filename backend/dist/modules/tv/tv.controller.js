"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeasonDetails = exports.getDetails = exports.getAnime = exports.getByGenre = exports.getTopRated = exports.getTrending = exports.getPopular = void 0;
const tvService = __importStar(require("./tv.service"));
const types_1 = require("../../types");
const getPopular = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const data = await tvService.getPopular(page);
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getPopular = getPopular;
const getTrending = async (_req, res, next) => {
    try {
        const data = await tvService.getTrending();
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getTrending = getTrending;
const getTopRated = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const data = await tvService.getTopRated(page);
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getTopRated = getTopRated;
const getByGenre = async (req, res, next) => {
    try {
        const genreId = req.params.genreId;
        const page = Number(req.query.page) || 1;
        if (!genreId)
            throw new types_1.AppError('Genre ID is required', 400);
        const data = await tvService.getByGenre(genreId, page);
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getByGenre = getByGenre;
const getAnime = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const data = await tvService.getAnime(page);
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getAnime = getAnime;
const getDetails = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id)
            throw new types_1.AppError('TV show ID is required', 400);
        const data = await tvService.getDetails(id);
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getDetails = getDetails;
const getSeasonDetails = async (req, res, next) => {
    try {
        const id = req.params.id;
        const seasonNumber = req.params.seasonNumber;
        if (!id || !seasonNumber)
            throw new types_1.AppError('TV show ID and season number are required', 400);
        const data = await tvService.getSeasonDetails(id, seasonNumber);
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getSeasonDetails = getSeasonDetails;
