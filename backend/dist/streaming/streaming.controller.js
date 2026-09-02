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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEpisodeStream = exports.getMovieStream = void 0;
const streamingService = __importStar(require("./streaming.service"));
const types_1 = require("../types");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET || 'chillers-super-secret-key-change-me';
async function isRequestPremium(req) {
    try {
        // 1. Vérification par header explicite si injecté par middleware
        if (req.headers['x-is-premium'] === 'true' || req.query.is_premium === 'true') {
            return true;
        }
        // 2. Vérification par Token JWT utilisateur
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            if (decoded?.role === 'admin')
                return true;
            if (decoded?.id) {
                const user = await User_1.User.findById(decoded.id).select('subscription role');
                if (user?.role === 'admin' || user?.subscription?.plan === 'premium') {
                    return true;
                }
            }
        }
    }
    catch (_) { }
    return false;
}
const getMovieStream = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id))
            throw new types_1.AppError('Valid TMDB movie ID is required', 400);
        const isPremium = await isRequestPremium(req);
        const result = await streamingService.getMovieStream({
            tmdbId: id,
            type: req.query.type || 'movie',
            title: req.query.title,
            language: req.query.language || 'fr',
            isPremium,
        });
        if (!result) {
            res.json({
                success: false,
                data: null,
                message: 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
            });
            return;
        }
        res.json({
            success: true,
            data: {
                embedUrl: result.embedUrl,
                quality: isPremium && result.provider === 'frenchstream' ? '1080p' : 'standard',
                isPremiumStream: isPremium && result.provider === 'frenchstream',
            },
            provider: result.provider,
            message: null,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMovieStream = getMovieStream;
const getEpisodeStream = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const season = parseInt(req.params.season, 10);
        const episode = parseInt(req.params.episode, 10);
        if (isNaN(id) || isNaN(season) || isNaN(episode)) {
            throw new types_1.AppError('Valid TMDB TV ID, season, and episode are required', 400);
        }
        const result = await streamingService.getEpisodeStream({
            tmdbId: id,
            type: req.query.type || 'tv',
            title: req.query.title,
            season,
            episode,
            language: req.query.language || 'fr',
        });
        if (!result) {
            res.json({
                success: false,
                data: null,
                message: 'Aucun flux disponible. Tous les fournisseurs ont échoué.',
            });
            return;
        }
        res.json({
            success: true,
            data: { embedUrl: result.embedUrl },
            provider: result.provider,
            message: null,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getEpisodeStream = getEpisodeStream;
