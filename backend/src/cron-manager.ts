import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';

function runProcess(name: string, command: string, args: string[]) {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] [Cron] Lancement : ${name} (${command} ${args.join(' ')})`);

    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l: string) => l)) {
            console.log(`[${name}] ${line}`);
        }
    });

    child.stderr.on('data', (data) => {
        for (const line of data.toString().split('\n').filter((l: string) => l)) {
            console.error(`[${name}] ${line}`);
        }
    });

    child.on('close', (code) => {
        const endTime = new Date().toISOString();
        if (code === 0) {
            console.log(`[${endTime}] [Cron] Terminé avec succès : ${name}`);
        } else {
            console.error(`[${endTime}] [Cron] ERREUR : ${name} (code: ${code})`);
        }
    });
}

function runScript(name: string, scriptRelativePath: string) {
    runProcess(name, 'npx', ['tsx', path.join(__dirname, scriptRelativePath)]);
}

function runNodeScript(name: string, scriptRelativePath: string) {
    runProcess(name, 'node', [path.join(__dirname, scriptRelativePath)]);
}

/**
 * Liste des tâches à exécuter immédiatement au démarrage ou via cron quotidien
 */
function runScrapingTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de scraping (quotidien)...`);
    runNodeScript('Scraping Films', 'scraping/core/scrape-films.js');
    runNodeScript('Scraping Séries', 'scraping/core/scrape-series.js');
}

function runMaintenanceTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de maintenance (horaire)...`);

    // 1. Maintenance des liens morts
    runNodeScript('Maintenance Liens', 'scraping/maintenance/maintainer.js');

    // 2. Linking TMDB (les scripts .js compilés lisent leurs JSON
    //    via src/config/data-paths.ts, donc OK depuis dist/).
    runNodeScript('Linking TMDB Films', 'scraping/maintenance/link-movies-tmdb.js');
    runNodeScript('Linking TMDB Séries', 'scraping/maintenance/link-series-tmdb.js');

    // 3. Organisation des fichiers Doodstream (déplace dans le dossier série)
    runNodeScript('Organize Séries Doodstream', 'scraping/maintenance/organize-series.js');

    // 4. Sync séries vers MongoDB — pousse les épisodes enrichis
    //    (fileCode, season, episodeNumber, fldId, tmdbId) dans la
    //    collection Serie. Le DoodStreamProvider lit Mongo en priorité.
    //    NB: on pointe vers src/ (le helper data-paths résout les JSON
    //    de manière absolue, donc OK depuis l'un ou l'autre).
    runNodeScript('Sync Séries → MongoDB', 'scraping/maintenance/sync-series-to-mongo.js');
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
