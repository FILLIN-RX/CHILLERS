import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from './config/db';
import { appendLog } from './config/log-buffer';
import { startCron, runner } from './managers/cron-manager';
import apiRouter from './api/router';

// Patcher console.log/error/warn pour que TOUT soit capté dans les logs SSE
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;
console.log = (...args: any[]) => {
  const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  origLog(...args);
  try { appendLog(line); } catch {}
};
console.error = (...args: any[]) => {
  const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  origError(...args);
  try { appendLog(`[ERROR] ${line}`); } catch {}
};
console.warn = (...args: any[]) => {
  const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  origWarn(...args);
  try { appendLog(`[WARN] ${line}`); } catch {}
};

const PORT = process.env.PORT || 4001;

async function main() {
  console.log(`[Scrapper] Démarrage du service de scraping (port ${PORT})...`);

  // Connexion MongoDB
  try {
    await connectDB();
    console.log('[Scrapper] MongoDB connecté');
  } catch (err) {
    console.error('[Scrapper] Échec connexion MongoDB:', err);
    process.exit(1);
  }

  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', uptime: process.uptime() }, message: null });
  });

  app.use('/api', apiRouter);

  app.use((_req, res) => {
    res.status(404).json({ success: false, data: null, message: 'Route not found' });
  });

  app.listen(PORT, () => {
    console.log(`[Scrapper] API en écoute sur http://0.0.0.0:${PORT}`);

    // Démarrer le cron automatiquement
    startCron();
    console.log('[Scrapper] Cron manager démarré automatiquement');

    // Lancer le scraping en continu (boucle infinie)
    console.log('[Scrapper] Lancement du scraping films continu...');
    runner('Scraping Films', 'src/scraping/scrape-films.ts');
    console.log('[Scrapper] Lancement du scraping séries continu...');
    runner('Scraping Séries', 'src/scraping/scrape-series.ts');
  });
}

main().catch((err) => {
  console.error('[Scrapper] Erreur fatale:', err);
  process.exit(1);
});
