import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';

/**
 * Exécute un script TypeScript via npx tsx
 */
function runScript(name: string, scriptRelativePath: string) {
    const fullPath = path.join(__dirname, scriptRelativePath);
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] [Cron] Lancement : ${name} (${scriptRelativePath})`);
    
    exec(`npx tsx ${fullPath}`, (error, stdout, stderr) => {
        const endTime = new Date().toISOString();
        if (error) {
            console.error(`[${endTime}] [Cron] ERREUR : ${name} (${scriptRelativePath})`);
            console.error(error);
            return;
        }
        console.log(`[${endTime}] [Cron] Terminé avec succès : ${name}`);
        if (stdout) console.log(`[${endTime}] [Cron] Output ${name}:`, stdout); // Log complet
    });
}

/**
 * Exécute un script JS natif (node)
 */
function runNodeScript(name: string, scriptRelativePath: string) {
    const fullPath = path.join(__dirname, scriptRelativePath);
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] [Cron] Lancement : ${name} (${scriptRelativePath})`);
    
    exec(`node ${fullPath}`, (error, stdout, stderr) => {
        const endTime = new Date().toISOString();
        if (error) {
            console.error(`[${endTime}] [Cron] ERREUR : ${name} (${scriptRelativePath})`);
            console.error(error);
            return;
        }
        console.log(`[${endTime}] [Cron] Terminé avec succès : ${name}`);
        if (stdout) console.log(`[${endTime}] [Cron] Output ${name}:`, stdout); // Log complet
    });
}

/**
 * Liste des tâches à exécuter immédiatement au démarrage ou via cron quotidien
 */
function runScrapingTasks() {
    console.log(`[${new Date().toISOString()}] [Cron] Lancement des tâches de scraping (quotidien)...`);
    runScript('Scraping Films', 'scraping/core/scrape-films.js');
    runScript('Scraping Séries', 'scraping/core/scrape-series.ts');
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
    runScript('Sync Séries → MongoDB', '../src/scraping/maintenance/sync-series-to-mongo.ts');
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
