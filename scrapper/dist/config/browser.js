"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowser = exports.browserConfig = void 0;
const playwright_1 = require("playwright");
exports.browserConfig = {
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
    ]
};
const getBrowser = async () => {
    return await playwright_1.chromium.launch(exports.browserConfig);
};
exports.getBrowser = getBrowser;
