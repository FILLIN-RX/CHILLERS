"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMiddleware = adminMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'chiller-jwt-secret-change-in-production';
function adminMiddleware(req, res, next) {
    const header = req.headers.authorization;
    const queryToken = req.query.token;
    const token = (header?.startsWith('Bearer ') ? header.split(' ')[1] : null) || queryToken;
    if (!token) {
        res.status(401).json({ success: false, data: null, message: 'Non autorisé' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    }
    catch {
        res.status(401).json({ success: false, data: null, message: 'Token invalide ou expiré' });
    }
}
