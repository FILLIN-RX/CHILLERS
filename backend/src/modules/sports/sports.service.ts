/**
 * Agrégateur des sources de foot additionnelles à LiveBall.
 *
 * Chaque source expose le même couple de fonctions (liste de matchs + résolution
 * de flux) ; ce module les interroge en parallèle, fusionne les résultats et
 * dispatche la résolution vers la bonne source. Une source en panne ne casse
 * jamais la réponse : elle est simplement contribution vide.
 */
import {
  getLiveBallMatches,
  resolveLiveBallStream,
  type LiveBallMatch,
} from '../liveball/liveball.service';
import { getKoraMatches, resolveKoraStream } from './kora.service';
import { getKooorahMatches, getYallaproMatches, resolveKooorahStream, resolveYallaproStream } from './yasirtv.service';
import { getStreamizMatches, resolveStreamizStream } from './livetv.service';
import { SPORTS_SOURCES, type ResolvedSportsStream, type SportsMatch, type SportsSourceId } from './sports.types';

export * from './sports.types';

async function listLiveBallMatches(): Promise<SportsMatch[]> {
  try {
    const raw = await getLiveBallMatches();
    return (raw || []).map((m: LiveBallMatch) => ({
      id: `liveball:${m.id}`,
      sourceId: m.id,
      source: 'liveball' as const,
      status: m.status,
      home: m.home,
      away: m.away,
      homeLogo: m.homeLogo,
      awayLogo: m.awayLogo,
      league: m.league,
      score: m.score,
      startTs: m.startTs,
    }));
  } catch {
    return [];
  }
}

async function resolveLiveBallStreamWrapper(id: string, force = false): Promise<ResolvedSportsStream | null> {
  try {
    const stream = await resolveLiveBallStream(id, force);
    if (!stream?.url) return null;
    return {
      url: stream.url,
      type: stream.type || 'hls',
      servers: [
        {
          name: 'Serveur 1 HD',
          url: stream.url,
          type: stream.type || 'hls',
        },
      ],
    };
  } catch {
    return null;
  }
}

const PROVIDERS: Record<
  SportsSourceId,
  { list: () => Promise<SportsMatch[]>; resolve: (sourceId: string, force?: boolean) => Promise<ResolvedSportsStream | null> }
> = {
  liveball: { list: listLiveBallMatches, resolve: (id) => resolveLiveBallStreamWrapper(id) },
  kora: { list: getKoraMatches, resolve: (id, force) => resolveKoraStream(id, force) },
  kooorah: { list: getKooorahMatches, resolve: (id, force) => resolveKooorahStream(id, force) },
  yallapro: { list: getYallaproMatches, resolve: (id, force) => resolveYallaproStream(id, force) },
  streamiz: { list: getStreamizMatches, resolve: (id, force) => resolveStreamizStream(id, force) },
};

export function isSportsSource(value: string): value is SportsSourceId {
  return (SPORTS_SOURCES as string[]).includes(value);
}

/**
 * Matchs de toutes les sources (ou d'une seule), dédupliqués et triés :
 * directs d'abord, puis par heure de coupure.
 */
export async function getSportsMatches(source?: string): Promise<SportsMatch[]> {
  const wanted: SportsSourceId[] = source && isSportsSource(source) ? [source] : SPORTS_SOURCES;

  const results = await Promise.allSettled(wanted.map((s) => PROVIDERS[s].list()));
  const matches: SportsMatch[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      matches.push(...result.value.filter((m) => m?.id && m?.sourceId));
    } else {
      console.warn(`[sports] source ${wanted[i]} indisponible:`, result.reason?.message);
    }
  });

  const seen = new Set<string>();
  return matches
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'live' ? -1 : 1;
      return (a.startTs ?? Number.MAX_SAFE_INTEGER) - (b.startTs ?? Number.MAX_SAFE_INTEGER);
    });
}

/** Résout le flux d'un match pour la source demandée. */
export async function resolveSportsStream(
  source: string,
  sourceId: string,
  force = false
): Promise<ResolvedSportsStream | null> {
  if (!isSportsSource(source)) return null;
  return PROVIDERS[source].resolve(sourceId, force);
}

/**
 * Retrouve un match à partir de son identifiant composite (`kora:75`,
 * `yallapro:1234`…). Permet d'utiliser des URL courtes et lisibles côté
 * frontend au lieu d'exposer les identifiants techniques de chaque source.
 */
export async function findSportsMatch(matchId: string): Promise<SportsMatch | null> {
  const separator = matchId.indexOf(':');
  if (separator === -1) return null;

  const source = matchId.slice(0, separator);
  if (!isSportsSource(source)) return null;

  const wanted = matchId.slice(separator + 1);
  const matches = await getSportsMatches(source);
  return matches.find((m) => m.sourceId === wanted || m.id === matchId) ?? null;
}

/** Résout le flux d'un match à partir de son identifiant composite. */
export async function resolveSportsStreamById(
  matchId: string,
  force = false
): Promise<{ match: SportsMatch; stream: ResolvedSportsStream } | null> {
  const match = await findSportsMatch(matchId);
  if (!match) return null;

  const stream = await resolveSportsStream(match.source, match.sourceId, force);
  return stream ? { match, stream } : null;
}

/** État de chaque source, pour le diagnostic et la page /live. */
export async function getSportsSourcesStatus(): Promise<Record<string, { ok: boolean; count: number }>> {
  const results = await Promise.allSettled(SPORTS_SOURCES.map((s) => PROVIDERS[s].list()));
  const status: Record<string, { ok: boolean; count: number }> = {};
  SPORTS_SOURCES.forEach((s, i) => {
    const r = results[i];
    status[s] = r.status === 'fulfilled' ? { ok: r.value.length > 0, count: r.value.length } : { ok: false, count: 0 };
  });
  return status;
}
