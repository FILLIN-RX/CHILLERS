"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Admin_1 = __importDefault(require("./models/Admin"));
const PORT = process.env.PORT || 4000;
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
(0, db_1.connectDB)().then(async () => {
    await seedAdmin();
    app_1.default.listen(PORT, () => {
        console.log(`[Chiller API] Running on http://localhost:${PORT}`);
        console.log(`[Chiller System] Cron manager attached and running.`);
    });
});
