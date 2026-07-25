"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDBStatus = exports.disconnectDB = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
let isConnected = false;
const connectDB = async () => {
    if (isConnected)
        return;
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error("MONGO_URI not defined in .env");
    }
    try {
        const conn = await mongoose_1.default.connect(uri);
        isConnected = true;
        console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    }
    catch (error) {
        console.error(`[MongoDB] Connection error:`, error);
        throw error;
    }
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    if (!isConnected)
        return;
    await mongoose_1.default.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected');
};
exports.disconnectDB = disconnectDB;
const getDBStatus = () => mongoose_1.default.connection.readyState;
exports.getDBStatus = getDBStatus;
