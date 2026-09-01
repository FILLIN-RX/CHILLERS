import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const ANTIBOT_SECRET = process.env.ANTIBOT_SECRET || 'chillers_antibot_secret_key_2025';
const MAX_TIME_DRIFT_SECONDS = 120; // 2 minutes de marge pour les dérives d'horloge

/**
 * Middleware de protection anti-scraping / anti-bot.
 * Vérifie l'en-tête dynamique "X-Client-Token" généré par le client officiel CHILLERS.
 */
export const antiBotMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Optionnel : bypass si désactivé en dev
  if (process.env.DISABLE_ANTIBOT === 'true') {
    return next();
  }

  // Permet de bypasser pour les webhooks ou requêtes internes avec clé spéciale
  const apiKey = req.headers['x-api-key'];
  if (apiKey && process.env.ADMIN_API_KEY && apiKey === process.env.ADMIN_API_KEY) {
    return next();
  }

  const clientToken = req.headers['x-client-token'] as string;

  if (!clientToken || typeof clientToken !== 'string') {
    res.status(403).json({
      success: false,
      data: null,
      message: 'Accès refusé : jeton client manquant.',
    });
    return;
  }

  const [tsStr, hash] = clientToken.split(',');

  if (!tsStr || !hash) {
    res.status(403).json({
      success: false,
      data: null,
      message: 'Accès refusé : format de jeton client invalide.',
    });
    return;
  }

  const clientTimestamp = parseInt(tsStr, 10);
  if (isNaN(clientTimestamp)) {
    res.status(403).json({
      success: false,
      data: null,
      message: 'Accès refusé : horodatage invalide.',
    });
    return;
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const timeDifference = Math.abs(currentTimestamp - clientTimestamp);

  // Vérification de l'expiration du timestamp pour empêcher le rejeu
  if (timeDifference > MAX_TIME_DRIFT_SECONDS) {
    res.status(403).json({
      success: false,
      data: null,
      message: 'Accès refusé : jeton client expiré.',
    });
    return;
  }

  // Recalcul de l'empreinte cryptographique
  const reversed = String(clientTimestamp).split('').reverse().join('');
  const expectedHash = crypto
    .createHash('md5')
    .update(`${reversed}_${ANTIBOT_SECRET}`)
    .digest('hex');

  if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
    res.status(403).json({
      success: false,
      data: null,
      message: 'Accès refusé : signature de sécurité non valide.',
    });
    return;
  }

  next();
};
