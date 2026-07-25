"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLinkDead = isLinkDead;
const axios_1 = __importDefault(require("axios"));
async function isLinkDead(url) {
    try {
        const response = await axios_1.default.head(url, {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return response.status !== 200;
    }
    catch {
        console.log(`[LinkCheck] Dead link detected: ${url}`);
        return true;
    }
}
