import type { Request, Response, NextFunction } from 'express';
import { appendLog } from '../../config/log-buffer';

/** Trace normalisée « match » : console + buffer admin (SSE des logs). */
export function matchLog(message: string) {
  const line = `[Match] ${new Date().toISOString()} ${message}`;
  console.log(line);
  appendLog(line);
}

/**
 * Journalise les requêtes liées à un match (résolution de flux, chaînes,
 * playlist HLS) avec statut + durée. Les segments vidéo relayés
 * (`/hls/proxy/`) déclenchent une requête toutes les quelques secondes par
 * lecteur : on ne les trace que s'ils échouent.
 */
export function matchLogger(req: Request, res: Response, next: NextFunction) {
  const isRelaySegment = req.path.includes('/hls/proxy/');
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    if (isRelaySegment && res.statusCode < 400) return;
    matchLog(
      `${req.method} ${req.originalUrl} → ${res.statusCode} ${ms}ms` +
        ` ip=${req.ip ?? '-'} ua=${req.headers['user-agent'] ?? '-'}`,
    );
  });

  next();
}
