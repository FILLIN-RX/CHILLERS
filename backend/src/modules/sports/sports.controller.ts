import type { Request, Response, NextFunction } from 'express';
import type { ResolvedSportsStream } from './sports.types';
import {
  getSportsMatches,
  getSportsSourcesStatus,
  isSportsSource,
  resolveSportsStream,
  resolveSportsStreamById,
} from './sports.service';

export const getMatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = req.query.source ? String(req.query.source) : undefined;
    if (source && !isSportsSource(source)) {
      res.status(400).json({ success: false, data: null, message: `Source inconnue: ${source}` });
      return;
    }

    const matches = await getSportsMatches(source);
    res.json({ success: true, data: matches, message: null });
  } catch (error) {
    next(error);
  }
};

export const getSources = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getSportsSourcesStatus();
    res.json({ success: true, data: status, message: null });
  } catch (error) {
    next(error);
  }
};

function relayBase(req: Request): string {
  const host = req.get('host') || 'localhost';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return `${protocol}://${host}/api/sports/match`;
}

/**
 * Sérialise un flux résolu pour le client : chaque serveur HLS reçoit l'URL de
 * notre relay, les serveurs iframe restent jouables tels quels.
 */
function serializeStream(req: Request, source: string, sourceId: string, stream: ResolvedSportsStream) {
  const servers = stream.servers.map((server, idx) => ({
    name: `Serveur ${idx + 1} HD`,
    url: server.url,
    type: server.type,
    relayUrl:
      server.type === 'hls'
        ? `${relayBase(req)}/${source}/${encodeURIComponent(sourceId)}/hls/playlist.m3u8?server=${idx}`
        : undefined,
  }));

  const primary = servers[0] ?? { url: stream.url, type: stream.type };

  return {
    url: primary.type === 'hls' ? primary.relayUrl : primary.url,
    directUrl: stream.url,
    relayUrl: primary.type === 'hls' ? primary.relayUrl : undefined,
    type: primary.type ?? stream.type,
    servers,
  };
}

export const getMatchStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = String(req.params.source);
    const sourceId = String(req.params.matchId);
    const forceRefresh = req.query.refresh === 'true' || req.query.force === '1';

    if (!isSportsSource(source)) {
      res.status(400).json({ success: false, data: null, message: `Source inconnue: ${source}` });
      return;
    }

    const stream = await resolveSportsStream(source, sourceId, forceRefresh);
    if (!stream) {
      res.status(404).json({ success: false, data: null, message: 'Flux introuvable' });
      return;
    }

    res.json({ success: true, data: serializeStream(req, source, sourceId, stream), message: null });
  } catch (error) {
    console.error('[Sports] Erreur de résolution du flux:', error);
    next(error);
  }
};

/** Variante par identifiant composite (`kora:75`) : URL courte côté frontend. */
export const getMatchStreamById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matchId = String(req.params.matchId);
    const forceRefresh = req.query.refresh === 'true' || req.query.force === '1';

    const resolved = await resolveSportsStreamById(matchId, forceRefresh);
    if (!resolved) {
      res.status(404).json({ success: false, data: null, message: 'Flux introuvable' });
      return;
    }

    const { match, stream } = resolved;
    res.json({
      success: true,
      data: { ...serializeStream(req, match.source, match.sourceId, stream), match },
      message: null,
    });
  } catch (error) {
    console.error('[Sports] Erreur de résolution du flux:', error);
    next(error);
  }
};
