import { chromium, LaunchOptions } from 'playwright';

/**
 * Configuration centralisée pour le lancement du navigateur Playwright.
 * Adapte les arguments pour l'environnement Docker (nécessite --no-sandbox).
 */
export const browserConfig: LaunchOptions = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
    ]
};

export const getBrowser = async () => {
    return await chromium.launch(browserConfig);
};

// Pour compatibilité CommonJS
module.exports = { browserConfig, getBrowser };
