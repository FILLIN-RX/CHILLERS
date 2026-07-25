import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { connectDB } from './config/db';
import { appendLog } from './config/log-buffer';
import { startCron } from './managers/cron-manager';
import apiRouter from './api/router';

const PORT = process.env.PORT || 4001;

async function main() {
  console.log(`[Scrapper] Démarrage du service de scraping (port ${PORT})...`);
  appendLog('[Scrapper] Service démarré');

  // Connexion MongoDB
  try {
    await connectDB();
    console.log('[Scrapper] MongoDB connecté');
    appendLog('[Scrapper] MongoDB connecté');
  } catch (err) {
    console.error('[Scrapper] Échec connexion MongoDB:', err);
    appendLog('[Scrapper] ERREUR: Échec connexion MongoDB');
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
    appendLog(`[Scrapper] API en écoute sur le port ${PORT}`);

    // Démarrer le cron automatiquement
    startCron();
    appendLog('[Scrapper] Cron manager démarré automatiquement');
  });
}

main().catch((err) => {
  console.error('[Scrapper] Erreur fatale:', err);
  process.exit(1);
});
