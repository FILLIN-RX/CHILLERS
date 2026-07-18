import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { appendLog } from './config/log-buffer';

const isDev = process.env.NODE_ENV !== 'production';

function resolveScript(relativePath: string): string {
    const fullPath = path.join(__dirname, relativePath);
    if (!isDev) return fullPath;
    const tsPath = fullPath.replace(/\.js$/, '.ts');
    if (fs.existsSync(tsPath)) return tsPath;
    return fullPath;
}

function runProcess(name: string, command: string, args: string[]) {
    const startTime = new Date().toISOString();
    const header = `[Cron] Lancement : ${name}`;
    console.log(`[${startTime}] ${header}`);
    appendLog(header);

    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l: string) => l)) {
            const msg = `[${name}] ${line}`;
            console.log(msg);
            appendLog(msg);
        }
    });

    child.stderr.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l: string) => l)) {
            const msg = `[${name}] ${line}`;
            console.error(msg);
            appendLog(msg);
        }
    });

    child.on('close', (code) => {
        const endTime = new Date().toISOString();
        const msg = code === 0
            ? `[Cron] Terminé avec succès : ${name}`
            : `[Cron] ERREUR : ${name} (code: ${code})`;
        console.log(`[${endTime}] ${msg}`);
        appendLog(msg);
    });
}

function runScript(name: string, scriptRelativePath: string) {
    runProcess(name, 'npx', ['tsx', resolveScript(scriptRelativePath)]);
}

function runNodeScript(name: string, scriptRelativePath: string) {
    runProcess(name, 'node', [resolveScript(scriptRelativePath)]);
}

/**
 * Liste des tâches à exécuter immédiatement au démarrage ou via cron quotidien
 * En dev (tsx) les scripts .js importent des modules .ts → utiliser tsx
 * En prod (node dist/) les .js compilés s'importent entre eux → utiliser node
 */
function runScrapingTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de scraping (quotidien)...`);
    const runner = isDev ? runScript : runNodeScript;
    runner('Scraping Films', 'scraping/core/scrape-films.js');
    runner('Scraping Séries', 'scraping/core/scrape-series.js');
}

function runMaintenanceTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de maintenance (horaire)...`);
    const runner = isDev ? runScript : runNodeScript;

    runner('Maintenance Liens', 'scraping/maintenance/maintainer.js');
    runner('Linking TMDB Films', 'scraping/maintenance/link-movies-tmdb.js');
    runner('Linking TMDB Séries', 'scraping/maintenance/link-series-tmdb.js');
    runner('Organize Séries Doodstream', 'scraping/maintenance/organize-series.js');
    runner('Sync Séries → MongoDB', 'scraping/maintenance/sync-series-to-mongo.js');
}

// 1. Lancer immédiatement au démarrage du serveur
runScrapingTasks();
runMaintenanceTasks();

// 2. Planifier : Maintenance toutes les heures
cron.schedule('0 * * * *', () => {
    runMaintenanceTasks();
});

// 3. Planifier : Scraping tous les jours à 03:00
cron.schedule('0 3 * * *', () => {
    runScrapingTasks();
});

console.log("[Cron] Gestionnaire de tâches planifiées (Cron) démarré (Fréquence : toutes les heures, + exécution au démarrage).");
