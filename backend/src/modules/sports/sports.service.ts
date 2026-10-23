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
import { createHash } from 'node:crypto';
import { getKoraMatches, resolveKoraStream } from './kora.service';
import { getKooorahMatches, getYallaproMatches, resolveKooorahStream, resolveYallaproStream } from './yasirtv.service';
import { getStreamizMatches, resolveStreamizStream } from './livetv.service';
import { CLOSE_KICKOFF_S, fixtureScore, isSameFixture } from './utils/fixture-match';
import { pickPlayableServer, pickPlayableServers } from './utils/stream-probe';
import { labFastPathServers } from './lab-fast-path';
import { SPORTS_SOURCES, type ResolvedSportsStream, type SportsMatch, type SportsServer, type SportsSourceId } from './sports.types';
import { getRegisteredChannels, rememberChannels } from './match-channels.registry';
import { mapTvChannelsToMatch } from './utils/channel-mapping';

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
 * Représentante d'une affiche publiée par plusieurs sources : les sources
 * HLS (liveball, kooorah…) passent avant kora, qui n'est qu'un repli.
 */
const SOURCE_PRIORITY: Record<SportsSourceId, number> = {
  liveball: 0,
  kooorah: 1,
  yallapro: 2,
  streamiz: 3,
  kora: 4,
};

function representative(a: SportsMatch, b: SportsMatch): SportsMatch {
  const pa = SOURCE_PRIORITY[a.source];
  const pb = SOURCE_PRIORITY[b.source];
  if (pa !== pb) return pa < pb ? a : b;
  if (a.status !== b.status) return a.status === 'live' ? a : b;
  return (a.startTs ?? Number.MAX_SAFE_INTEGER) <= (b.startTs ?? Number.MAX_SAFE_INTEGER) ? a : b;
}

/** Slug d'URL neutle : `sourceId` lisible s'il en est un, sinon hash de la rencontre. */
function readableSlug(m: SportsMatch): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(m.sourceId) ? m.sourceId.toLowerCase() : null;
}

function fixtureHash(m: SportsMatch): string {
  return `f${createHash('sha1').update(`${m.home}|${m.away}|${m.startTs ?? ''}`).digest('hex').slice(0, 10)}`;
}

/**
 * Matchs de toutes les sources (ou d'une seule), dédupliqués par rencontre et
 * triés : directs d'abord, puis par heure de coupure. Chaque affiche n'apparaît
 * qu'une fois — la source représentante est la meilleure (kora en dernier) —
 * et porte un `slug` neutle pour le routing.
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

  // Regroupement par rencontre : les entrées datées sont parcourues en ordre
  // de coupure d'envoi (fenêtre de 2 × la tolérance isSameFixture), les
  // entrées sans heure comparées entre elles.
  const WINDOW_S = CLOSE_KICKOFF_S * 2;
  const withTs = matches
    .filter((m) => m.startTs !== undefined)
    .sort((a, b) => (a.startTs as number) - (b.startTs as number));
  const withoutTs = matches.filter((m) => m.startTs === undefined);

  const groups: SportsMatch[] = [];
  for (const m of withTs) {
    let merged = false;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if ((m.startTs as number) - (g.startTs as number) > WINDOW_S) break;
      if (isSameFixture(g, m)) {
        groups[i] = representative(g, m);
        merged = true;
        break;
      }
    }
    if (!merged) groups.push(m);
  }
  for (const m of withoutTs) {
    let merged = false;
    for (let i = 0; i < groups.length; i++) {
      if (isSameFixture(groups[i], m)) {
        groups[i] = representative(groups[i], m);
        merged = true;
        break;
      }
    }
    if (!merged) groups.push(m);
  }

  // Expiry filter: drop matches that have likely ended.
  //   • 'upcoming' with startTs > 3 h ago → missed, definitely over
  //   • any status with startTs > 4 h ago  → safety net for stale 'live' markers
  const nowSec = Math.floor(Date.now() / 1000);
  const active = groups.filter((m) => {
    if (m.startTs === undefined) return true; // no timestamp → always keep
    const ageSec = nowSec - m.startTs;
    if (m.status === 'upcoming') return ageSec < 3 * 3600; // drop upcoming older than 3h
    return ageSec < 4 * 3600;                              // drop live/unknown older than 4h
  });

  // Slug neutle : `sourceId` lisible si personne d'autre ne le porte déjà,
  // sinon hash stable de la rencontre (pas de collision, pas de provider).
  const based = active.map((m) => ({ ...m, slug: readableSlug(m) ?? fixtureHash(m) }));
  const slugCounts = new Map<string, number>();
  for (const m of based) slugCounts.set(m.slug as string, (slugCounts.get(m.slug as string) ?? 0) + 1);
  const sorted = based
    .map((m) => (slugCounts.get(m.slug as string)! > 1 ? { ...m, slug: fixtureHash(m) } : m))
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
  if (separator === -1) {
    // URL neutle (`/live/sp/478`, `/live/sp/499`, `/live/sp/f3a9c2…`) : pas de provider dans
    // l'identifiant, on cherche le slug, le sourceId ou l'identifiant dans la liste.
    if (!matchId) return null;
    const matches = await getSportsMatches();
    const found = matches.find((m) => m.slug === matchId || m.sourceId === matchId || m.id === matchId || m.id.endsWith(`:${matchId}`));
    if (found) return found;

    // Si pas trouvé dans la liste dédupliquée, chercher dans chaque source individuellement
    for (const src of SPORTS_SOURCES) {
      const srcMatches = await getSportsMatches(src).catch(() => []);
      const match = srcMatches.find((m) => m.sourceId === matchId || m.id === `${src}:${matchId}` || m.slug === matchId);
      if (match) return match;
    }
    return null;
  }

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
/** Agrégation de tous les providers : on parcourt toute la chaîne, pas seulement le premier qui joue. */
const MULTI_CHAIN_DEADLINE_MS = 30_000;
const ATTEMPT_BUDGET_MS = 7_000;
/** Un seul lien de secours par provider : évite d'exposer plusieurs miroirs du même provider. */
const MAX_SERVERS_PER_PROVIDER = 1;
const FLUX_OK_TTL = 3 * 60_000;
const FLUX_KO_TTL = 30_000;
const FLUX_CACHE = new Map<string, { ts: number; data: SportsFlux | null; complete: boolean }>();

export interface ResolveSportsOptions {
  /**
   * Ne pas s'arrêter au premier provider jouable : sonder toute la chaîne et
   * agréger tous les serveurs du match (le mode normal sert toujours le
   * premier, aucun changement de comportement par défaut).
   */
  collectAll?: boolean;
}

function limitServersPerProvider(servers: SportsServer[]): SportsServer[] {
  const seenProviders = new Set<string>();
  const seenUrls = new Set<string>();
  const limited: SportsServer[] = [];
  for (const server of servers) {
    const provider = server.source ?? (server.external ? `external:${server.name}` : `unknown:${server.name || server.url}`);
    if (!server.url || seenProviders.has(provider) || seenUrls.has(server.url)) continue;
    seenProviders.add(provider);
    seenUrls.add(server.url);
    limited.push(server);
  }
  return limited;
}

function withBudget<T>(promise: Promise<T>, budgetMs: number): Promise<T | null> {
  if (budgetMs <= 0) return Promise.resolve(null);
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs))]);
}

/**
 * Le match demandé d'abord, puis ses jumeaux découverts chez les autres sources
 * — kora en tout dernier : c'est un repli, pas la source primaire.
 *
 * ⚠ On interroge chaque source SÉPARÉMENT (liste brute non dédupliquée) afin
 * de retrouver tous les providers qui couvrent ce même match. La liste globale
 * `getSportsMatches()` collapse en effet tous les providers en une seule entrée
 * (le gagnant de la priorité) : les jumeaux kora/kooorah y seraient invisibles.
 */
async function chainCandidates(target: SportsMatch): Promise<SportsMatch[]> {
  // Récupère la liste brute de chaque source en parallèle (cache 30 s individuel).
  const perSource = await Promise.allSettled(SPORTS_SOURCES.map((s) => getSportsMatches(s)));
  const rawAll: SportsMatch[] = [];
  for (const r of perSource) {
    if (r.status === 'fulfilled') rawAll.push(...r.value);
  }

  const own = rawAll.find((m) => m.id === target.id) ?? target;

  const twins = rawAll
    .filter((m) => m.id !== own.id && isSameFixture(own, m))
    .map((m) => ({ m, score: fixtureScore(own, m), gap: Math.abs((m.startTs ?? 0) - (own.startTs ?? 0)) }))
    .sort((a, b) => b.score - a.score || a.gap - b.gap)
    .map((x) => x.m);

  // Le match demandé doit TOUJOURS être testé en premier.
  // Ses jumeaux ne sont tentés qu'en cas d'échec du flux principal,
  // en privilégiant les sources HLS directes (liveball, kooorah...) avant kora.
  const otherTwins = twins.filter((m) => m.id !== own.id);
  const sortedTwins = [
    ...otherTwins.filter((m) => m.source !== 'kora'),
    ...otherTwins.filter((m) => m.source === 'kora'),
  ];

  return [own, ...sortedTwins];
}

/**
 * Chaîne de providers : comme pour les films, on sert le premier qui a vraiment
 * le flux. Chaque candidat est résolu puis sondé, un player qui répond sans rien
 * diffuser ne compte pas comme une réussite.
 *
 * En mode `collectAll`, la chaîne est épuisée et tous les serveurs jouables de
 * tous les jumeaux du match sont agrégés dans `stream.servers`, chacun tagué de
 * sa source d'origine (nom + relay HLS à reconstruire côté client).
 */
export async function resolveSportsFlux(
  target: SportsMatch,
  force = false,
  opts: ResolveSportsOptions = {},
): Promise<SportsFlux | null> {
  const collectAll = opts.collectAll === true;
  const cached = FLUX_CACHE.get(target.id);
  const fresh = cached !== undefined && Date.now() - cached.ts < (cached.data ? FLUX_OK_TTL : FLUX_KO_TTL);
  if (!force && fresh) {
    // Le mode agrégé a besoin du résultat exhaustif : un cache partiel (servi en
    // mode normal) ne suffit pas et relance la chaîne.
    if (!collectAll || cached.complete) return cached.data;
  }

  const deadline = Date.now() + (collectAll ? MULTI_CHAIN_DEADLINE_MS : CHAIN_DEADLINE_MS);
  const candidates = await chainCandidates(target);
  const attempts: string[] = [];
  const servers: SportsServer[] = [];
  let primary: SportsFlux | null = null;
  let exhausted = true;

  // Fast path lab : les HLS du snapshot frais, probeés à la volée, partent en
  // premier — inutile de re-scrappe le provider quand le lab les a déjà.
  const labServers = labFastPathServers(target);
  if (labServers.length) {
    const labBudget = Math.min(ATTEMPT_BUDGET_MS, deadline - Date.now());
    const labPlayable = await withBudget(
      pickPlayableServers({ url: labServers[0].url, type: 'hls', servers: labServers }).catch(() => []),
      labBudget,
    );
    if (labPlayable && labPlayable.length > 0) {
      servers.push(...labPlayable);
      primary = {
        stream: { url: labPlayable[0].url, type: 'hls', servers: labPlayable },
        source: labPlayable[0].source ?? target.source,
        sourceId: labPlayable[0].sourceId ?? target.sourceId,
      };
      attempts.push(`lab=${labPlayable.length} HLS`);
      console.log(`[sports] flux servi par le lab (${labPlayable.length} HLS déjà récolté(s)) pour ${target.id}`);
    } else {
      attempts.push('lab=aucun HLS jouable');
    }
  }

  // Mode normal : un lab jouable suffit. En agrégation, la chaîne continue
  // pour compléter avec les providers.
  const chain = !primary || collectAll ? candidates : [];

  for (const candidate of chain) {
    const budget = Math.min(ATTEMPT_BUDGET_MS, deadline - Date.now());
    if (budget <= 0) {
      attempts.push(`${candidate.source}=budget épuisé`);
      exhausted = false;
      break;
    }

    const resolved = await withBudget(PROVIDERS[candidate.source].resolve(candidate.sourceId, force), budget);
    if (!resolved?.url) {
      attempts.push(`${candidate.source}=aucun flux`);
      continue;
    }

    const probeBudget = Math.min(ATTEMPT_BUDGET_MS, deadline - Date.now());
    const playable = await withBudget(
      (collectAll
        ? pickPlayableServers(resolved)
        : pickPlayableServer(resolved).then((s) => (s ? [s] : []))
      ).catch(() => []),
      probeBudget,
    );
    if (!playable || playable.length === 0) {
      attempts.push(`${candidate.source}=flux non jouable`);
      continue;
    }

    const tagged: SportsServer[] = playable.map((s) => ({
      ...s,
      source: candidate.source,
      sourceId: candidate.sourceId,
    }));
    servers.push(...tagged);

    if (!primary) {
      primary = {
        stream: { url: tagged[0].url, type: tagged[0].type ?? 'iframe', servers: tagged },
        source: candidate.source,
        sourceId: candidate.sourceId,
      };
      console.log(
        `[sports] flux servi par "${candidate.source}" après ${attempts.length + 1} tentative(s) pour ${target.id} (${tagged[0].type})`
      );
    }

    if (!collectAll) {
      // Mode normal : le premier qui joue suffit, on laisse la suite pour plus tard.
      break;
    }
  }
  if (collectAll && Date.now() >= deadline) exhausted = false;

  // Mapping diffuseurs TV : si le match est diffusé sur une chaîne TV disponible
  // (beIN Sports, Canal+, SSC, Eurosport, etc.), on l'ajoute aux serveurs.
  // Une source peut retourner plusieurs miroirs, mais ceux-ci ne sont pas
  // autant de providers indépendants. On conserve le meilleur lien testé par
  // provider (HLS d'abord, l'ordre de pickPlayableServers le garantit).
  const providerServers = collectAll ? limitServersPerProvider(servers) : servers;
  const mappedServers = mapTvChannelsToMatch(target, providerServers);
  const boundedServers = limitServersPerProvider(mappedServers);

  if (!primary) {
    // Si aucun provider web ne diffuse mais qu'une chaîne TV correspondante existe,
    // on l'utilise directement comme flux principal au lieu d'échouer en 404 !
    const tvFallback = boundedServers.find((s) => s.type === 'hls');
    if (tvFallback) {
      primary = {
        stream: { url: tvFallback.url, type: 'hls', servers: boundedServers },
        source: target.source,
        sourceId: target.sourceId,
      };
      console.log(`[sports] flux TV direct servi pour ${target.id} via ${tvFallback.name}`);
    } else {
      console.warn(`[sports] aucun provider jouable pour ${target.id}: ${attempts.join(', ') || 'aucun candidat'}`);
      FLUX_CACHE.set(target.id, { ts: Date.now(), data: null, complete: exhausted && collectAll });
      return null;
    }
  }

  const finalServers = boundedServers.length > 0 ? boundedServers : providerServers;

  const flux: SportsFlux = {
    stream: { ...primary.stream, servers: finalServers },
    source: primary.source,
    sourceId: primary.sourceId,
  };

  if (collectAll) {
    console.log(
      `[sports] agrégation pour ${target.id} : ${finalServers.length} serveur(s)${exhausted ? '' : ' (chaîne incomplète : budget)'}`
    );
  }

  const complete = collectAll && exhausted;
  FLUX_CACHE.set(target.id, { ts: Date.now(), data: flux, complete });
  // Registre mémoire (24 h) : le prochain appel /channels part de ce point de
  // départ sans repeindre toute la chaîne.
  rememberChannels(target.id, { source: flux.source, sourceId: flux.sourceId, servers: finalServers, complete });
  return flux;
}

/** Variante par identifiant composite (`liveball:1534869`). */
export async function resolveSportsFluxById(
  matchId: string,
  force = false,
  opts: ResolveSportsOptions = {},
): Promise<{ match: SportsMatch; flux: SportsFlux } | null> {
  const match = await findSportsMatch(matchId);
  if (!match) return null;

  const flux = await resolveSportsFlux(match, force, opts);
  return flux ? { match, flux } : null;
}

/** Matchs dont une agrégation est déjà en vol (évite de lancer la chaîne deux fois). */
const collectInFlight = new Set<string>();

/**
 * Anti-raz-de-marée : si la collecte complète échoue (budget, providers en
 * panne), on ne la relance pas à chaque appel /channels — 60 s de répit, puis
 * nouvelle tentative.
 */
const COLLECT_COOLDOWN_MS = 60_000;
const lastCollectAt = new Map<string, number>();

/**
 * Enchaîne l'agrégation complète en arrière-plan. Le flux principal part tout
 * de suite (le premier provider qui joue suffit au player), les autres serveurs
 * arrivent dans le registre quelques secondes plus tard — le prochain appel
 * /channels les sert alors instantanément.
 */
export function warmupMatchChannels(match: SportsMatch): void {
  if (collectInFlight.has(match.id)) return;
  if (getRegisteredChannels(match.id)?.complete) return;
  const last = lastCollectAt.get(match.id) ?? 0;
  if (Date.now() - last < COLLECT_COOLDOWN_MS) return;

  lastCollectAt.set(match.id, Date.now());
  collectInFlight.add(match.id);
  resolveSportsFlux(match, false, { collectAll: true })
    .catch((err) => console.warn(`[sports] agrégation en arrière-plan échouée pour ${match.id}:`, err))
    .finally(() => collectInFlight.delete(match.id));
}
