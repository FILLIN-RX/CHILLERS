/**
 * Agrégateur des sources de foot additionnelles à LiveBall.
 *
 * Chaque source expose le même couple de fonctions (liste de matchs + résolution
 * de flux). Pour la liste on les interroge en parallèle et on fusionne ; pour le
 * flux on les chaîne une par une (comme les films) et on sert le premier qui
 * diffuse réellement. Une source en panne ne casse jamais la réponse : elle est
 * simplement contribution vide.
 */
import {
  getLiveBallMatches,
  resolveLiveBallStream,
  type LiveBallMatch,
} from '../liveball/liveball.service';
import { getKoraMatches, resolveKoraStream } from './kora.service';
import { getKooorahMatches, getYallaproMatches, resolveKooorahStream, resolveYallaproStream } from './yasirtv.service';
import { getStreamizMatches, resolveStreamizStream } from './livetv.service';
import { fixtureScore, isSameFixture } from './utils/fixture-match';
import { pickPlayableServer } from './utils/stream-probe';
import { SPORTS_SOURCES, type ResolvedSportsStream, type SportsMatch, type SportsSourceId } from './sports.types';

export * from './sports.types';

async function listLiveBallMatches(): Promise<SportsMatch[]> {
  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
    const raw = await Promise.race([getLiveBallMatches(), timeoutPromise]);
    if (!raw) return [];
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
  liveball: { list: listLiveBallMatches, resolve: (id, force) => resolveLiveBallStreamWrapper(id, force) },
  kora: { list: getKoraMatches, resolve: (id, force) => resolveKoraStream(id, force) },
  kooorah: { list: getKooorahMatches, resolve: (id, force) => resolveKooorahStream(id, force) },
  yallapro: { list: getYallaproMatches, resolve: (id, force) => resolveYallaproStream(id, force) },
  streamiz: { list: getStreamizMatches, resolve: (id, force) => resolveStreamizStream(id, force) },
};

export function isSportsSource(value: string): value is SportsSourceId {
  return (SPORTS_SOURCES as string[]).includes(value);
}

const MATCHES_CACHE = new Map<string, { ts: number; data: SportsMatch[] }>();

/**
 * Matchs de toutes les sources (ou d'une seule), dédupliqués et triés :
 * directs d'abord, puis par heure de coupure.
 */
export async function getSportsMatches(source?: string): Promise<SportsMatch[]> {
  const cacheKey = source || 'all';
  const cached = MATCHES_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < 30_000) {
    return cached.data;
  }

  const wanted: SportsSourceId[] = source && isSportsSource(source) ? [source] : SPORTS_SOURCES;

  const results = await Promise.allSettled(wanted.map((s) => PROVIDERS[s].list()));
  const matches: SportsMatch[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      // Une rencontre a deux adversaires : les sources comme yallapro publient
      // des canaux (libellé seul, sans `away`) qui ne sont pas des matchs.
      matches.push(...result.value.filter((m) => m?.id && m?.sourceId && m.away?.trim()));
    } else {
      console.warn(`[sports] source ${wanted[i]} indisponible:`, result.reason?.message);
    }
  });

  const seen = new Set<string>();
  const sorted = matches
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'live' ? -1 : 1;
      return (a.startTs ?? Number.MAX_SAFE_INTEGER) - (b.startTs ?? Number.MAX_SAFE_INTEGER);
    });

  MATCHES_CACHE.set(cacheKey, { ts: Date.now(), data: sorted });
  return sorted;
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

/** Flux retenu par la chaîne, avec la source qui le sert (le match affiché peut en venir d'une autre). */
export interface SportsFlux {
  stream: ResolvedSportsStream;
  source: SportsSourceId;
  sourceId: string;
}

const CHAIN_DEADLINE_MS = 18_000;
const ATTEMPT_BUDGET_MS = 7_000;
const FLUX_OK_TTL = 3 * 60_000;
const FLUX_KO_TTL = 30_000;
const FLUX_CACHE = new Map<string, { ts: number; data: SportsFlux | null }>();

function withBudget<T>(promise: Promise<T>, budgetMs: number): Promise<T | null> {
  if (budgetMs <= 0) return Promise.resolve(null);
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs))]);
}

/** Le match demandé d'abord, puis ses jumeaux découverts chez les autres sources. */
async function chainCandidates(target: SportsMatch): Promise<SportsMatch[]> {
  const all = await getSportsMatches();
  const own = all.find((m) => m.id === target.id) ?? target;

  const twins = all
    .filter((m) => m.id !== own.id && isSameFixture(own, m))
    .map((m) => ({ m, score: fixtureScore(own, m), gap: Math.abs((m.startTs ?? 0) - (own.startTs ?? 0)) }))
    .sort((a, b) => b.score - a.score || a.gap - b.gap)
    .map((x) => x.m);

  return [own, ...twins];
}

/**
 * Chaîne de providers : comme pour les films, on sert le premier qui a vraiment
 * le flux. Chaque candidat est résolu puis sondé, un player qui répond sans rien
 * diffuser ne compte pas comme une réussite.
 */
export async function resolveSportsFlux(target: SportsMatch, force = false): Promise<SportsFlux | null> {
  const cached = FLUX_CACHE.get(target.id);
  if (!force && cached && Date.now() - cached.ts < (cached.data ? FLUX_OK_TTL : FLUX_KO_TTL)) {
    return cached.data;
  }

  const deadline = Date.now() + CHAIN_DEADLINE_MS;
  const candidates = await chainCandidates(target);
  const attempts: string[] = [];

  for (const candidate of candidates) {
    const budget = Math.min(ATTEMPT_BUDGET_MS, deadline - Date.now());
    if (budget <= 0) {
      attempts.push(`${candidate.source}=budget épuisé`);
      break;
    }

    const resolved = await withBudget(PROVIDERS[candidate.source].resolve(candidate.sourceId, force), budget);
    if (!resolved?.url) {
      attempts.push(`${candidate.source}=aucun flux`);
      continue;
    }

    const playable = await withBudget(
      pickPlayableServer(resolved).catch(() => null),
      Math.min(ATTEMPT_BUDGET_MS, deadline - Date.now()),
    );
    if (!playable) {
      attempts.push(`${candidate.source}=flux non jouable`);
      continue;
    }

    const flux: SportsFlux = {
      stream: { url: playable.url, type: playable.type ?? 'iframe', servers: [playable] },
      source: candidate.source,
      sourceId: candidate.sourceId,
    };
    console.log(
      `[sports] flux servi par "${candidate.source}" après ${attempts.length + 1} tentative(s) pour ${target.id} (${playable.type})`
    );
    FLUX_CACHE.set(target.id, { ts: Date.now(), data: flux });
    return flux;
  }

  console.warn(`[sports] aucun provider jouable pour ${target.id}: ${attempts.join(', ') || 'aucun candidat'}`);
  FLUX_CACHE.set(target.id, { ts: Date.now(), data: null });
  return null;
}

/** Variante par identifiant composite (`liveball:1534869`). */
export async function resolveSportsFluxById(
  matchId: string,
  force = false
): Promise<{ match: SportsMatch; flux: SportsFlux } | null> {
  const match = await findSportsMatch(matchId);
  if (!match) return null;

  const flux = await resolveSportsFlux(match, force);
  return flux ? { match, flux } : null;
}
