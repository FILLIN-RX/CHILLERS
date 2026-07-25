"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
const cron_manager_1 = require("./cron-manager");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Admin_1 = __importDefault(require("./models/Admin"));
const PORT = process.env.PORT || 4000;
/**
 * En production, refuse de démarrer avec des secrets par défaut/faibles.
 * Évite qu'un déploiement tourne avec admin/admin ou un JWT_SECRET connu.
 */
function assertProductionSecrets() {
    if (process.env.NODE_ENV !== 'production')
        return;
    const problems = [];
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'chiller-admin-secret-change-me') {
        problems.push('JWT_SECRET manquant ou par défaut');
    }
    if (problems.length > 0) {
        throw new Error(`[Chiller] Démarrage refusé en production — secrets non sécurisés: ${problems.join(', ')}`);
    }
}
async function seedAdmin() {
    const count = await Admin_1.default.countDocuments();
    if (count === 0) {
        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'admin';
        const hashed = await bcryptjs_1.default.hash(password, 10);
        await Admin_1.default.create({ username, password: hashed });
        console.log(`[Admin] Compte admin créé: ${username}`);
    }
}
assertProductionSecrets();
(0, db_1.connectDB)().then(async () => {
    await seedAdmin();
    app_1.default.listen(PORT, () => {
        console.log(`[Chiller API] Running on http://localhost:${PORT}`);
        // Démarre le scheduler (scraping + maintenance) sauf opt-out explicite.
        if (process.env.DISABLE_CRON === 'true') {
            console.log(`[Chiller System] Cron manager disabled (DISABLE_CRON=true).`);
        }
        else {
            (0, cron_manager_1.startCron)();
            console.log(`[Chiller System] Cron manager attached and running.`);
        }
        // Migration DoodStream → Uqload une fois par déploiement (non bloquant).
        (0, cron_manager_1.runDeployTasksOnce)().catch((err) => console.error('[Deploy] Migration Uqload échouée:', err));
    });
});
