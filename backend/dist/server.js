"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const db_1 = require("./config/db");
require("./cron-manager");
const PORT = process.env.PORT || 4000;
(0, db_1.connectDB)().then(() => {
    app_1.default.listen(PORT, () => {
        console.log(`[Chiller API] Running on http://localhost:${PORT}`);
        console.log(`[Chiller System] Cron manager attached and running.`);
    });
});
