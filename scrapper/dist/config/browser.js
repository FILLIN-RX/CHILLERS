"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowser = exports.browserConfig = void 0;
exports.setupFastContext = setupFastContext;
exports.setupFastPage = setupFastPage;
const playwright_1 = require("playwright");
exports.browserConfig = {
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled'
    ]
};
const getBrowser = async () => {
    return await playwright_1.chromium.launch(exports.browserConfig);
};
exports.getBrowser = getBrowser;
async function setupFastContext(context) {
    await context.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
            return route.abort();
        }
        return route.continue();
    });
}
async function setupFastPage(page) {
    await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
            return route.abort();
        }
        return route.continue();
    });
}
