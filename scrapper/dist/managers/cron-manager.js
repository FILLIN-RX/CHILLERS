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
const log_buffer_1 = require("../config/log-buffer");
const isDev = process.env.NODE_ENV !== 'production';
let cronTasks = [];
let isRunning = false;
const runningProcesses = new Map();
function runProcess(name, command, args) {
    const startTime = new Date().toISOString();
    const header = `[Cron] Lancement : ${name}`;
    console.log(`[${startTime}] ${header}`);
    (0, log_buffer_1.appendLog)(header);
    const child = (0, child_process_1.spawn)(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    runningProcesses.set(name, child);
    child.stdout.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l) => l)) {
            const msg = `[${name}] ${line}`;
            console.log(msg);
            (0, log_buffer_1.appendLog)(msg);
        }
    });
    child.stderr.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l) => l)) {
            const msg = `[${name}] ${line}`;
            console.error(msg);
            (0, log_buffer_1.appendLog)(msg);
        }
    });
    child.on('close', (code) => {
        runningProcesses.delete(name);
        const endTime = new Date().toISOString();
        const msg = code === 0
            ? `[Cron] Terminé avec succès : ${name}`
            : `[Cron] ERREUR : ${name} (code: ${code})`;
        console.log(`[${endTime}] ${msg}`);
        (0, log_buffer_1.appendLog)(msg);
    });
}
function stopTask(name) {
    const child = runningProcesses.get(name);
    if (!child)
        return false;
    (0, log_buffer_1.appendLog)(`[Admin] Arrêt demandé : ${name}`);
    child.kill('SIGTERM');
    return true;
}
function getRunningTasks() {
    return Array.from(runningProcesses.keys());
}
function runScrapingTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de scraping...`);
    (0, log_buffer_1.appendLog)('[Cron] Lancement scraping films...');
    (0, exports.runner)('Scraping Films', 'src/scraping/scrape-films.ts');
    (0, log_buffer_1.appendLog)('[Cron] Lancement scraping séries...');
    (0, exports.runner)('Scraping Séries', 'src/scraping/scrape-series.ts');
}
function runMaintenanceTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de maintenance...`);
    (0, log_buffer_1.appendLog)('[Cron] Lancement maintenance liens...');
    (0, exports.runner)('Maintenance Liens', 'src/maintenance/maintainer.ts');
    (0, log_buffer_1.appendLog)('[Cron] Lancement linking TMDB films...');
    (0, exports.runner)('Linking TMDB Films', 'src/maintenance/link-movies-tmdb.ts');
    (0, log_buffer_1.appendLog)('[Cron] Lancement linking TMDB séries...');
    (0, exports.runner)('Linking TMDB Séries', 'src/maintenance/link-series-tmdb.ts');
}
function startCron() {
    if (isRunning)
        return;
    cronTasks = [
        node_cron_1.default.schedule('0 * * * *', runMaintenanceTasks),
        node_cron_1.default.schedule('0 3 * * *', runScrapingTasks),
    ];
    isRunning = true;
    (0, log_buffer_1.appendLog)('[Cron] Tâches planifiées démarrées (toutes les heures + scraping 03:00)');
    console.log('[Cron] Tâches planifiées démarrées.');
}
function stopCron() {
    if (!isRunning)
        return;
    cronTasks.forEach(t => t.stop());
    cronTasks = [];
    isRunning = false;
    (0, log_buffer_1.appendLog)('[Cron] Tâches planifiées arrêtées');
    console.log('[Cron] Tâches planifiées arrêtées.');
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
