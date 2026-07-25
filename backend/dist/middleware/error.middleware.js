"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const errorMiddleware = (err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const internalMessage = err.message || 'Internal server error';
    console.error(`[ERROR] ${statusCode} - ${internalMessage}`);
    // On ne renvoie le détail au client que pour les erreurs "attendues"
    // (< 500, typiquement des AppError de validation). Pour les 500, message
    // générique afin de ne pas fuiter d'information interne.
    const clientMessage = statusCode < 500 ? internalMessage : 'Internal server error';
    res.status(statusCode).json({
        success: false,
        data: null,
        message: clientMessage,
    });
};
exports.errorMiddleware = errorMiddleware;
