"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const errorMiddleware = (err, _req, res, _next) => {
    const statusCode = err.statusCode || err.response?.status || 500;
    const internalMessage = err.response?.data?.status_message || err.message || 'Internal server error';
    console.error(`[ERROR] ${statusCode} - ${internalMessage}`);
    const clientMessage = statusCode < 500 ? internalMessage : 'Internal server error';
    res.status(statusCode).json({
        success: false,
        data: null,
        message: clientMessage,
    });
};
exports.errorMiddleware = errorMiddleware;
