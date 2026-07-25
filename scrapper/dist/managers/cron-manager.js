"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runner = void 0;
exports.stopTask = stopTask;
exports.getRunningTasks = getRunningTasks;
exports.runScrapingTasks = runScrapingTasks;
exports.runMaintenanceTasks = runMaintenanceTasks;
exports.startCron = startCron;
exports.stopCron = stopCron;
exports.getCronStatus = getCronStatus;
const node_cron_1 = __importDefault(require("node-cron"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const isDev = process.env.NODE_ENV !== 'production';
let cronTasks = [];
let isRunning = false;
const runningProcesses = new Map();
function runProcess(name, command, args) {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] [Cron] Lancement : ${name}`);
    const child = (0, child_process_1.spawn)(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    runningProcesses.set(name, child);
    child.stdout.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l) => l)) {
            console.log(`[${name}] ${line}`);
        }
    });
    child.stderr.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l) => l)) {
            console.error(`[${name}] ${line}`);
        }
    });
    child.on('close', (code) => {
        runningProcesses.delete(name);
        const endTime = new Date().toISOString();
        if (code === 0) {
            console.log(`[${endTime}] [Cron] Terminé avec succès : ${name}`);
        }
        else {
            console.error(`[${endTime}] [Cron] ERREUR : ${name} (code: ${code})`);
        }
    });
}
function stopTask(name) {
    const child = runningProcesses.get(name);
    if (!child)
        return false;
    console.log(`[Admin] Arrêt demandé : ${name}`);
    child.kill('SIGTERM');
    return true;
}
function getRunningTasks() {
    return Array.from(runningProcesses.keys());
}
function runScrapingTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Scraping continu déjà lancé — rien à faire`);
}
function runMaintenanceTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de maintenance...`);
    (0, exports.runner)('Maintenance Liens', 'src/maintenance/maintainer.ts');
    (0, exports.runner)('Linking TMDB Films', 'src/maintenance/link-movies-tmdb.ts');
    (0, exports.runner)('Linking TMDB Séries', 'src/maintenance/link-series-tmdb.ts');
}
function startCron() {
    if (isRunning)
        return;
    cronTasks = [
        node_cron_1.default.schedule('0 10 * * *', runMaintenanceTasks),
    ];
    isRunning = true;
    console.log('[Cron] Maintenance planifiée à 11h00 (heure Cameroun, UTC+1)');
}
function stopCron() {
    if (!isRunning)
        return;
    cronTasks.forEach(t => t.stop());
    cronTasks = [];
    isRunning = false;
    console.log('[Cron] Tâches planifiées arrêtées');
}
function getCronStatus() {
    return { running: isRunning, tasks: cronTasks.length };
}
function resolveScript(relativePath) {
    if (isDev) {
        return path_1.default.join(process.cwd(), relativePath);
    }
    const jsPath = relativePath.replace(/\.ts$/, '.js').replace('src/', 'dist/');
    return path_1.default.join(process.cwd(), jsPath);
}
const runner = (name, scriptPath) => {
    if (isDev) {
        runProcess(name, 'npx', ['tsx', resolveScript(scriptPath)]);
    }
    else {
        runProcess(name, 'node', [resolveScript(scriptPath)]);
    }
};
exports.runner = runner;
