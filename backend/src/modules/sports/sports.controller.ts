import type { Request, Response, NextFunction } from 'express';
import type { ResolvedSportsStream } from './sports.types';
import {
  findSportsMatch,
  getSportsMatches,
  getSportsSourcesStatus,
  isSportsSource,
  resolveSportsFlux,
  resolveSportsFluxById,
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
 * Sérialise le flux retenu par la chaîne : un seul lecteur, celui qui a répondu.
 * Les HLS passent par notre relay (referer/IP côté serveur), les players iframe
 * restent embarqués tels quels.
 */
function serializeStream(req: Request, source: string, sourceId: string, stream: ResolvedSportsStream) {
  const server = stream.servers[0] ?? { name: source, url: stream.url, type: stream.type };
  const type = server.type ?? stream.type;
  const relayUrl =
    type === 'hls'
      ? `${relayBase(req)}/${source}/${encodeURIComponent(sourceId)}/hls/playlist.m3u8`
      : undefined;

  return {
    url: type === 'hls' && relayUrl ? relayUrl : server.url,
    directUrl: server.url,
    relayUrl,
    type,
    /** Referer attendu par le lecteur (beaucoup d'hôtes sont « domain protected »). */
    referer: server.referer,
    /** Source qui sert effectivement le flux — pas forcément celle du match affiché. */
    provider: source,
    servers: [{ name: source.toUpperCase(), url: server.url, type, relayUrl, referer: server.referer }],
  };
}

/** Chaîne de providers à partir du match demandé (les jumeaux des autres sources sont tentés). */
export const getMatchStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = String(req.params.source);
    const sourceId = String(req.params.matchId);
    const forceRefresh = req.query.refresh === 'true' || req.query.force === '1';

    if (!isSportsSource(source)) {
      res.status(400).json({ success: false, data: null, message: `Source inconnue: ${source}` });
      return;
    }

    const match = await findSportsMatch(`${source}:${sourceId}`);
    if (!match) {
      res.status(404).json({ success: false, data: null, message: 'Match introuvable' });
      return;
    }

    const flux = await resolveSportsFlux(match, forceRefresh);
    if (!flux) {
      res.status(404).json({ success: false, data: null, message: 'Flux introuvable' });
      return;
    }

    res.json({
      success: true,
      data: { ...serializeStream(req, flux.source, flux.sourceId, flux.stream), match },
      message: null,
    });
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

    const resolved = await resolveSportsFluxById(matchId, forceRefresh);
    if (!resolved) {
      res.status(404).json({ success: false, data: null, message: 'Flux introuvable' });
      return;
    }

    const { match, flux } = resolved;
    res.json({
      success: true,
      data: { ...serializeStream(req, flux.source, flux.sourceId, flux.stream), match },
      message: null,
    });
  } catch (error) {
    console.error('[Sports] Erreur de résolution du flux:', error);
    next(error);
  }
};
