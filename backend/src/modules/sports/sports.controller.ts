import type { Request, Response, NextFunction } from 'express';
import type { ResolvedSportsStream, SportsMatch, SportsServer } from './sports.types';
import {
  findSportsMatch,
  getSportsMatches,
  getSportsSourcesStatus,
  isSportsSource,
  resolveSportsFlux,
  resolveSportsFluxById,
  warmupMatchChannels,
} from './sports.service';
import { MULTI_SERVER_ENABLED, getRegisteredChannels } from './match-channels.registry';
import { matchLog } from './match-logger';

/** Libellé compact d'un match pour les traces serveur (`PSG vs OM [kora:478]`). */
function matchLabel(match: SportsMatch): string {
  const teams = match.away ? `${match.home} vs ${match.away}` : match.home;
  return `${teams} [${match.id}]`;
}

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
 * Sérialise le flux retenu par la chaîne : le premier serveur est celui qui a
 * répondu, les suivants sont les autres serveurs/jumeaux du match (mode
 * agrégé). Les HLS passent par notre relay (referer/IP côté serveur), les
 * players iframe restent embarqués tels quels — chaque serveur porte son
 * relay, car il vient éventuellement d'une autre source.
 */
function serializeStream(req: Request, source: string, sourceId: string, stream: ResolvedSportsStream) {
  const list: SportsServer[] = stream.servers.length
    ? stream.servers
    : [{ name: source, url: stream.url, type: stream.type }];

  // Le lien direct (HLS, surtout via notre relay) prime : l'embed provider
  // n'est qu'un repli quand aucun HLS n'a été trouvé. À type égal, le meilleur
  // score de fiabilité passe devant.
  const rank = (s: SportsServer) => (s.type === 'hls' ? 0 : 1);
  const ordered = [...list].sort(
    (a, b) => rank(a) - rank(b) || (b.score ?? 0) - (a.score ?? 0),
  );

  const servers = ordered.map((s) => {
    const provider = s.source ?? source;
    const sid = s.sourceId ?? sourceId;
    const type = (s.type ?? stream.type) as 'hls' | 'iframe';
    const relayUrl =
      s.relayUrl ??
      (!s.external && s.source && s.sourceId && type === 'hls'
        ? `${relayBase(req)}/${provider}/${encodeURIComponent(sid)}/hls/playlist.m3u8`
        : undefined);
    return {
      // Le nom du canal (« BeIN Sport 1 », « TNT 5 ») rend le sélecteur lisible ;
      // à défaut on retombe sur le nom de la source.
      name: s.name?.trim() || provider.toUpperCase(),
      url: s.url,
      directUrl: s.url,
      type,
      relayUrl,
      /** Referer attendu par le lecteur (beaucoup d'hôtes sont « domain protected »). */
      referer: s.referer,
      /** Source qui sert effectivement ce serveur — pas forcément celle du match affiché. */
      provider: s.external ? undefined : provider,
      sourceId: s.external ? undefined : sid,
      external: s.external,
      /** Probabilité estimée de flux jouable au prochain essai (0..1). */
      score: s.score,
    };
  });

  const primary = servers[0];
  return {
    url: primary.type === 'hls' && primary.relayUrl ? primary.relayUrl : primary.url,
    directUrl: primary.directUrl,
    relayUrl: primary.relayUrl,
    type: primary.type,
    /** Referer attendu par le lecteur (beaucoup d'hôtes sont « domain protected »). */
    referer: primary.referer,
    /** Source qui sert effectivement le flux — pas forcément celle du match affiché. */
    provider: primary.provider,
    servers,
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

    // Le player part tout de suite, l'agrégation des autres serveurs suit en
    // arrière-plan (registre 24 h) : le prochain /channels est instantané.
    if (MULTI_SERVER_ENABLED) warmupMatchChannels(match);

    const payload = serializeStream(req, flux.source, flux.sourceId, flux.stream);
    matchLog(
      `Flux résolu ${matchLabel(match)} type=${payload.type} serveurs=${payload.servers.length} source=${flux.source}`,
    );
    res.json({
      success: true,
      data: { ...payload, match },
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
    if (MULTI_SERVER_ENABLED) warmupMatchChannels(match);
    const payload = serializeStream(req, flux.source, flux.sourceId, flux.stream);
    matchLog(
      `Flux résolu ${matchLabel(match)} type=${payload.type} serveurs=${payload.servers.length} source=${flux.source}`,
    );
    res.json({
      success: true,
      data: { ...payload, match },
      message: null,
    });
  } catch (error) {
    console.error('[Sports] Erreur de résolution du flux:', error);
    next(error);
  }
};

/**
 * Tous les serveurs connus du match : le registre 24 h répond s'il est déjà
 * peuplé, sinon la chaîne complète est épuisée (une fois — ensuite tout est
 * servi depuis le registre). L'agrégation est active par défaut ; définir
 * `SPORTS_MULTI_SERVER=0` pour la désactiver explicitement.
 */
export const getChannels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = String(req.params.matchId);
    const forceRefresh = req.query.refresh === 'true' || req.query.force === '1';

    // L'identifiant peut être neutle (slug d'URL sans provider) : le registre
    // est toujours indexé par l'identifiant composite du match.
    const match = await findSportsMatch(rawId);
    if (!match) {
      res.status(404).json({ success: false, data: null, message: 'Aucun serveur connu pour ce match' });
      return;
    }
    const matchId = match.id;

    if (!forceRefresh) {
      const registered = getRegisteredChannels(matchId);
      if (registered && registered.servers.length > 0) {
        // Registre partiel (flux principal seul, la collecte complète est en
        // vol ou morte) : on relance l'agrégation en arrière-plan, la réponse
        // part immédiatement avec ce qu'on a déjà.
        if (!registered.complete) warmupMatchChannels(match);
        const cachedStream: ResolvedSportsStream = {
          url: registered.servers[0].url,
          type: registered.servers[0].type ?? 'iframe',
          servers: registered.servers,
        };
        matchLog(
          `Chaînes ${matchId}: ${registered.servers.length} serveur(s) depuis le registre (complet=${registered.complete})`,
        );
        res.json({
          success: true,
          data: {
            ...serializeStream(req, registered.source, registered.sourceId, cachedStream),
            complete: registered.complete,
          },
          message: null,
        });
        return;
      }
    }

    const flux = await resolveSportsFlux(match, forceRefresh, { collectAll: true });
    if (!flux) {
      res.status(404).json({ success: false, data: null, message: 'Aucun serveur connu pour ce match' });
      return;
    }

    const complete = getRegisteredChannels(match.id)?.complete ?? true;
    matchLog(
      `Chaînes ${matchId}: ${flux.stream.servers.length} serveur(s) collectés pour ${matchLabel(match)} (complet=${complete})`,
    );
    res.json({
      success: true,
      data: {
        ...serializeStream(req, flux.source, flux.sourceId, flux.stream),
        match,
        complete,
      },
      message: null,
    });
  } catch (error) {
    console.error('[Sports] Erreur de collecte des chaînes:', error);
    next(error);
  }
};
