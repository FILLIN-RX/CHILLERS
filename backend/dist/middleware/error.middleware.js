"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const errorMiddleware = (err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    console.error(`[ERROR] ${statusCode} - ${message}`);
    res.status(statusCode).json({
        success: false,
        data: null,
        message,
    });
};
exports.errorMiddleware = errorMiddleware;
