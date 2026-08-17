"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const db_1 = require("./config/db");
const log_buffer_1 = require("./config/log-buffer");
const cron_manager_1 = require("./managers/cron-manager");
const router_1 = __importDefault(require("./api/router"));
// Patcher console.log/error/warn pour que TOUT soit capté dans les logs SSE
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;
console.log = (...args) => {
    const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    origLog(...args);
    try {
        (0, log_buffer_1.appendLog)(line);
    }
    catch { }
};
console.error = (...args) => {
    const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    origError(...args);
    try {
        (0, log_buffer_1.appendLog)(`[ERROR] ${line}`);
    }
    catch { }
};
console.warn = (...args) => {
    const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    origWarn(...args);
    try {
        (0, log_buffer_1.appendLog)(`[WARN] ${line}`);
    }
    catch { }
};
const PORT = process.env.PORT || 4001;
async function main() {
    console.log(`[Scrapper] Démarrage du service de scraping (port ${PORT})...`);
    // Connexion MongoDB
    try {
        await (0, db_1.connectDB)();
        console.log('[Scrapper] MongoDB connecté');
    }
    catch (err) {
        console.error('[Scrapper] Échec connexion MongoDB:', err);
        process.exit(1);
    }
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            callback(null, true);
        },
        credentials: true,
    }));
    app.use(express_1.default.json());
    app.get('/api/health', (_req, res) => {
        res.json({ success: true, data: { status: 'ok', uptime: process.uptime() }, message: null });
    });
    app.use('/api', router_1.default);
    app.use((_req, res) => {
        res.status(404).json({ success: false, data: null, message: 'Route not found' });
    });
    app.listen(PORT, () => {
        console.log(`[Scrapper] API en écoute sur http://0.0.0.0:${PORT}`);
        // Démarrer le cron automatiquement
        (0, cron_manager_1.startCron)();
        console.log('[Scrapper] Cron manager démarré automatiquement');
        // Lancer le scraping en continu (boucle infinie)
        console.log('[Scrapper] Lancement du scraping films continu...');
        (0, cron_manager_1.runner)('Scraping Films', 'src/scraping/scrape-films.ts');
        console.log('[Scrapper] Lancement du scraping séries continu...');
        (0, cron_manager_1.runner)('Scraping Séries', 'src/scraping/scrape-series.ts');
        console.log('[Scrapper] Lancement du scraping animes continu...');
        (0, cron_manager_1.runner)('Scraping Animes', 'src/scraping/scrape-animes.ts');
    });
}
main().catch((err) => {
    console.error('[Scrapper] Erreur fatale:', err);
    process.exit(1);
});
