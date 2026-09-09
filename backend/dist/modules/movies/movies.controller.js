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
exports.getAfrican = exports.getByGenre = exports.getTrailer = exports.getRecommendations = exports.getDetails = exports.getTopRated = exports.getUpcoming = exports.getTrending = exports.getPopular = void 0;
const moviesService = __importStar(require("./movies.service"));
const types_1 = require("../../types");
const global_subscription_service_1 = require("../../services/global-subscription.service");
function getLang(req) {
    return req.query.language;
}
/**
 * Helper function to check if user can access premium content
 * Returns true if global subscription is ON and user has active premium
 * Returns false if global subscription is OFF (regardless of user subscription)
 */
async function canAccessPremium(req) {
    try {
        // Get global subscription state
        const globalState = await global_subscription_service_1.globalSubscriptionService.getGlobalState();
        // If global state is OFF, deny access
        if (!globalState.enabled) {
            return false;
        }
        // If global state is ON, check user subscription
        const user = req.user;
        if (!user?.subscription) {
            return false;
        }
        // Check if user has active premium subscription
        const subscription = user.subscription;
        return (subscription.plan !== 'free' &&
            subscription.status === 'active' &&
            (!subscription.expiresAt || new Date(subscription.expiresAt) > new Date()));
    }
    catch (error) {
        // On service error, deny access (fail-safe)
        console.error('Premium access check error:', error);
        return false;
    }
}
const getPopular = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const data = await moviesService.getPopular(page, getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getPopular = getPopular;
const getTrending = async (req, res, next) => {
    try {
        const data = await moviesService.getTrending(getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getTrending = getTrending;
const getUpcoming = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const data = await moviesService.getUpcoming(page, getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getUpcoming = getUpcoming;
const getTopRated = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const data = await moviesService.getTopRated(page, getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getTopRated = getTopRated;
const getDetails = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id)
            throw new types_1.AppError('Movie ID is required', 400);
        // Check if global subscription state permits access to premium content
        const globalState = await global_subscription_service_1.globalSubscriptionService.getGlobalState();
        if (!globalState.enabled) {
            // Premium features disabled globally - return 403
            res.status(403).json({
                success: false,
                data: null,
                message: 'This feature is unavailable',
            });
            return;
        }
        // Check if user has premium subscription if global state is ON
        const user = req.user;
        if (user?.subscription) {
            const hasPremium = user.subscription.plan !== 'free' &&
                user.subscription.status === 'active' &&
                (!user.subscription.expiresAt || new Date(user.subscription.expiresAt) > new Date());
            if (!hasPremium) {
                res.status(403).json({
                    success: false,
                    data: null,
                    message: 'Premium subscription required',
                });
                return;
            }
        }
        else {
            // No subscription data = free tier
            res.status(403).json({
                success: false,
                data: null,
                message: 'Premium subscription required',
            });
            return;
        }
        const data = await moviesService.getDetails(id, getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getDetails = getDetails;
const getRecommendations = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id)
            throw new types_1.AppError('Movie ID is required', 400);
        const data = await moviesService.getRecommendations(id, getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getRecommendations = getRecommendations;
const getTrailer = async (req, res, next) => {
    try {
        const id = req.params.id;
        if (!id)
            throw new types_1.AppError('Movie ID is required', 400);
        const data = await moviesService.getTrailer(id, getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getTrailer = getTrailer;
const getByGenre = async (req, res, next) => {
    try {
        const genreId = req.params.genreId;
        const page = Number(req.query.page) || 1;
        if (!genreId)
            throw new types_1.AppError('Genre ID is required', 400);
        const data = await moviesService.getByGenre(genreId, page, getLang(req));
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getByGenre = getByGenre;
const getAfrican = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const country = req.query.country;
        const data = await moviesService.getAfrican(page, getLang(req), country);
        res.json({ success: true, data, message: null });
    }
    catch (error) {
        next(error);
    }
};
exports.getAfrican = getAfrican;
