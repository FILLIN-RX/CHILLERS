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
exports.getTv = exports.getMovie = void 0;
const nexstreamService = __importStar(require("./nexstream.service"));
const types_1 = require("../../types");
const getMovie = async (req, res, next) => {
    try {
        const id = req.params.id;
        const progress = req.query.progress ? Number(req.query.progress) : undefined;
        if (!id)
            throw new types_1.AppError('Movie ID is required', 400);
        const embedUrl = nexstreamService.getMovieEmbedUrl(id, progress);
        res.json({ success: true, data: { embedUrl }, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getMovie = getMovie;
const getTv = async (req, res, next) => {
    try {
        const id = req.params.id;
        const season = req.params.season;
        const episode = req.params.episode;
        const progress = req.query.progress ? Number(req.query.progress) : undefined;
        if (!id || !season || !episode)
            throw new types_1.AppError('TV ID, season, and episode are required', 400);
        const embedUrl = nexstreamService.getTvEmbedUrl(id, season, episode, progress);
        res.json({ success: true, data: { embedUrl }, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getTv = getTv;
