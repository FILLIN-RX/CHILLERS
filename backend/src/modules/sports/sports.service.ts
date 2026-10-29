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
  fetchLiveBallHomepage,
  getLiveBallMatches,
  parseBlocks,
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
import { getProviderScore, recordProviderOutcome, refreshProviderStats } from './provider-score';

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
 * Un lien partagé (`/live/sp/1603075`) code l'identifiant d'UN provider. Quand
 * celui-ci retire la rencontre de sa liste — rotation, fin de diffusion — alors
 * que le match continue chez un autre, le lien tomberait sur « flux
 * introuvable ». On garde l'affiche derrière chaque identifiant vu pour la
 * relire dans la liste courante, quel que soit le provider qui la porte encore.
 */
const MATCH_ALIASES = new Map<string, { match: SportsMatch; ts: number }>();
const ALIAS_TTL_MS = 12 * 3600_000;

function rememberMatchAliases(members: SportsMatch[]) {
  const ts = Date.now();
  for (const member of members) {
    MATCH_ALIASES.set(`${member.source}:${member.sourceId}`, { match: member, ts });
    MATCH_ALIASES.set(member.sourceId, { match: member, ts });
  }
  if (MATCH_ALIASES.size > 2000) {
    for (const [key, entry] of MATCH_ALIASES) {
      if (ts - entry.ts > ALIAS_TTL_MS) MATCH_ALIASES.delete(key);
    }
  }
}

/**
 * L'affiche mémorisée et son jumeau actuel : les libellés comptent, pas l'heure.
 * Une source peut publier un coup d'envoi faux (décalage de fuseau) ; exiger la
 * fenêtre ferait échouer la reprise d'un lien pourtant identifié.
 */
function sameFixtureByName(a: SportsMatch, b: SportsMatch): boolean {
  return fixtureScore(a, b) >= 0.75;
}

/** Affiches mémorisées sous cet identifiant (nu ou `kora:659`). */
function recallMatches(matchId: string): SportsMatch[] {
  const now = Date.now();
  const recalled: SportsMatch[] = [];
  for (const [key, entry] of MATCH_ALIASES) {
    if (now - entry.ts > ALIAS_TTL_MS) {
      MATCH_ALIASES.delete(key);
      continue;
    }
    if (key === matchId || key.endsWith(`:${matchId}`)) recalled.push(entry.match);
  }
  return recalled;
}

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
  // Le direct passe avant la priorité du provider : une source qui annonce
  // encore « à venir » ne doit pas masquer le match déjà commencé ailleurs —
  // la carte afficherait « VS » et l'expiration des matchs à venir
  // supprimerait la rencontre, flux compris.
  if (a.status !== b.status) return a.status === 'live' ? a : b;
  // À direct égal, l'entrée qui publie le score représente la rencontre : c'est
  // l'information la plus visible de la carte (streamiz n'en publie aucun).
  if (Boolean(a.score) !== Boolean(b.score)) return a.score ? a : b;
  const pa = SOURCE_PRIORITY[a.source];
  const pb = SOURCE_PRIORITY[b.source];
  if (pa !== pb) return pa < pb ? a : b;
  return (a.startTs ?? Number.MAX_SAFE_INTEGER) <= (b.startTs ?? Number.MAX_SAFE_INTEGER) ? a : b;
}

/** Slug d'URL neutle : `sourceId` lisible s'il en est un, sinon hash de la rencontre. */
function readableSlug(m: SportsMatch): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(m.sourceId) ? m.sourceId.toLowerCase() : null;
}

function fixtureHash(m: SportsMatch): string {
  return `f${createHash('sha1').update(`${m.home}|${m.away}|${m.startTs ?? ''}`).digest('hex').slice(0, 10)}`;
}

/** Score live brut, rafraîchi à 5 s : sert aux alertes but et à l'affichage. */
export interface LiveScoreSnapshot {
  source: 'liveball';
  id: string;
  score: string;
  minute?: string;
}

let LIVE_SCORE_CACHE: { at: number; scores: LiveScoreSnapshot[] } | null = null;

export async function getLiveScoreSnapshot(): Promise<{ scores: LiveScoreSnapshot[]; updatedAt: number }> {
  if (LIVE_SCORE_CACHE && Date.now() - LIVE_SCORE_CACHE.at < 5_000) {
    return { scores: LIVE_SCORE_CACHE.scores, updatedAt: LIVE_SCORE_CACHE.at };
  }
  try {
    const html = await fetchLiveBallHomepage();
    const scores = parseBlocks(html)
      .filter((match) => match.status === 'live' && match.score)
      .map((match) => ({
        source: 'liveball' as const,
        id: match.id,
        score: match.score as string,
        minute: match.minute,
      }));
    LIVE_SCORE_CACHE = { at: Date.now(), scores };
    return { scores, updatedAt: LIVE_SCORE_CACHE.at };
  } catch {
    return LIVE_SCORE_CACHE
      ? { scores: LIVE_SCORE_CACHE.scores, updatedAt: LIVE_SCORE_CACHE.at }
      : { scores: [], updatedAt: 0 };
  }
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

  const groups: Array<{ match: SportsMatch; members: SportsMatch[] }> = [];
  for (const m of withTs) {
    let merged = false;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if ((m.startTs as number) - (g.match.startTs as number) > WINDOW_S) break;
      if (isSameFixture(g.match, m)) {
        g.match = representative(g.match, m);
        g.members.push(m);
        merged = true;
        break;
      }
    }
    if (!merged) groups.push({ match: m, members: [m] });
  }
  for (const m of withoutTs) {
    let merged = false;
    for (let i = 0; i < groups.length; i++) {
      if (isSameFixture(groups[i].match, m)) {
        groups[i].match = representative(groups[i].match, m);
        groups[i].members.push(m);
        merged = true;
        break;
      }
    }
    if (!merged) groups.push({ match: m, members: [m] });
  }

  // Expiry filter: drop matches that have likely ended.
  //   • 'upcoming' with startTs > 3 h ago → missed, definitely over
  //   • any status with startTs > 4 h ago  → safety net for stale 'live' markers
  const nowSec = Math.floor(Date.now() / 1000);
  const active = groups.filter(({ match: m }) => {
    if (m.startTs === undefined) return true; // no timestamp → always keep
    const ageSec = nowSec - m.startTs;
    if (m.status === 'upcoming') return ageSec < 3 * 3600; // drop upcoming older than 3h
    return ageSec < 4 * 3600;                              // drop live/unknown older than 4h
  });

  active.forEach((g) => rememberMatchAliases(g.members));

  // Slug neutle : `sourceId` lisible si personne d'autre ne le porte déjà,
  // sinon hash stable de la rencontre (pas de collision, pas de provider).
  const based = active.map(({ match }) => ({ ...match, slug: readableSlug(match) ?? fixtureHash(match) }));
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

    // Provider d'origine disparu de sa liste : retrouver l'affiche mémorisée
    // dans la liste actuelle (un autre provider la diffuse peut-être encore).
    const current = await getSportsMatches();
    for (const remembered of recallMatches(matchId)) {
      const found = current.find((m) => sameFixtureByName(m, remembered));
      if (found) return found;
    }
    return null;
  }

  const source = matchId.slice(0, separator);
  if (!isSportsSource(source)) return null;

  const wanted = matchId.slice(separator + 1);
  const matches = await getSportsMatches(source);
  const found = matches.find((m) => m.sourceId === wanted || m.id === matchId);
  if (found) return found;

  const current = await getSportsMatches();
  for (const remembered of recallMatches(matchId)) {
    const twin = current.find((m) => sameFixtureByName(m, remembered));
    if (twin) return twin;
  }
  return null;
}

/** État de chaque source, pour le diagnostic et la page /live. */
export async function getSportsSourcesStatus(): Promise<Record<string, { ok: boolean; count: number; score: number }>> {
  // Premier appel après démarrage : on attend le chargement des scores, sinon
  // le diagnostic afficherait 50 % pour tout le monde.
  await refreshProviderStats().catch(() => {});
  const results = await Promise.allSettled(SPORTS_SOURCES.map((s) => PROVIDERS[s].list()));
  const status: Record<string, { ok: boolean; count: number; score: number }> = {};
  SPORTS_SOURCES.forEach((s, i) => {
    const r = results[i];
    status[s] = {
      ok: r.status === 'fulfilled' && r.value.length > 0,
      count: r.status === 'fulfilled' ? r.value.length : 0,
      // Fiabilité observée (sondes passées), pas le nombre de matchs listés.
      score: Math.round(getProviderScore(s) * 100) / 100,
    };
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
/**
 * Candidats gardés par provider. Un provider qui publie plusieurs miroirs ne
 * doit pas être réduit à un seul lien : si le premier meurt entre la collecte
 * et le clic, le suivant est déjà là. `SPORTS_SERVERS_PER_PROVIDER` ajuste.
 */
const MAX_SERVERS_PER_PROVIDER = Math.min(
  5,
  Math.max(1, Number(process.env.SPORTS_SERVERS_PER_PROVIDER ?? 2) || 2),
);
/** Un flux TV apparié n'a pas été sondé : probabilité moyenne, pas nulle. */
const TV_SERVER_SCORE = 0.55;
/** HLS déjà récolté ET re-sondé par le lab : le candidat le plus sûr. */
const LAB_SERVER_SCORE = 0.95;
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

/** Ordre de préférence d'une liste de serveurs : HLS d'abord, puis meilleur score. */
function rankServers(servers: SportsServer[]): SportsServer[] {
  return servers
    .map((server, index) => ({ server, index }))
    .sort((a, b) => {
      const typeA = a.server.type === 'hls' ? 0 : 1;
      const typeB = b.server.type === 'hls' ? 0 : 1;
      if (typeA !== typeB) return typeA - typeB;
      const scoreA = a.server.score ?? 0;
      const scoreB = b.server.score ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.index - b.index;
    })
    .map((entry) => entry.server);
}

function candidateServerScore(providerScore: number, server: SportsServer): number {
  const bonus = server.type === 'hls' ? 0.1 : 0;
  return Math.round(Math.min(0.99, providerScore + bonus) * 100) / 100;
}

function limitServersPerProvider(servers: SportsServer[]): SportsServer[] {
  const perProvider = new Map<string, number>();
  const seenUrls = new Set<string>();
  const limited: SportsServer[] = [];
  for (const server of rankServers(servers)) {
    const provider = server.source ?? (server.external ? `external:${server.name}` : `unknown:${server.name || server.url}`);
    if (!server.url || seenUrls.has(server.url)) continue;
    const count = perProvider.get(provider) ?? 0;
    if (count >= MAX_SERVERS_PER_PROVIDER) continue;
    perProvider.set(provider, count + 1);
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
 * Le match demandé et ses jumeaux découverts chez les autres sources, classés
 * par probabilité de donner un flux jouable : fiabilité historique du provider
 * (55 %), correspondance de l'affiche (30 %), match déjà en direct (15 %).
 *
 * ⚠ On interroge chaque source SÉPARÉMENT (liste brute non dédupliquée) afin
 * de retrouver tous les providers qui couvrent ce même match. La liste globale
 * `getSportsMatches()` collapse en effet tous les providers en une seule entrée
 * (le gagnant de la priorité) : les jumeaux kora/kooorah y seraient invisibles.
 */
async function chainCandidates(target: SportsMatch): Promise<SportsMatch[]> {
  // Scores à jour avant le tri ; une base indisponible laisse tout à 50 %.
  await refreshProviderStats().catch(() => {});

  // Récupère la liste brute de chaque source en parallèle (cache 30 s individuel).
  const perSource = await Promise.allSettled(SPORTS_SOURCES.map((s) => getSportsMatches(s)));
  const rawAll: SportsMatch[] = [];
  for (const r of perSource) {
    if (r.status === 'fulfilled') rawAll.push(...r.value);
  }

  const own = rawAll.find((m) => m.id === target.id) ?? target;
  const candidates = [own, ...rawAll.filter((m) => m.id !== own.id && isSameFixture(own, m))];

  return candidates
    .map((m, index) => ({
      match: m,
      index,
      rank:
        getProviderScore(m.source) * 0.55 +
        fixtureScore(own, m) * 0.3 +
        (m.status === 'live' ? 0.15 : 0),
    }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.match);
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
  // Un échec ne prouve quelque chose que sur un match commencé : avant le coup
  // d'envoi, « aucun flux » est le comportement normal, pas une défaillance du
  // provider. Sans ce garde-fou, le préchauffage ferait couler tous les scores.
  const liveAttempt = target.status === 'live';
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
      // Sonde fraîche : le lab a déjà récolté et vérifié ces HLS.
      const labTagged = labPlayable.map((s) => ({ ...s, score: LAB_SERVER_SCORE }));
      servers.push(...labTagged);
      primary = {
        stream: { url: labTagged[0].url, type: 'hls', servers: labTagged },
        source: labTagged[0].source ?? target.source,
        sourceId: labTagged[0].sourceId ?? target.sourceId,
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
      if (liveAttempt) recordProviderOutcome(candidate.source, 'fail');
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
      if (liveAttempt) recordProviderOutcome(candidate.source, 'fail');
      continue;
    }

    // Score du provider observé + bonus HLS : ce que le client affichera comme
    // probabilité de réussite, et la clé de tri du sélecteur de sources.
    const providerScore = getProviderScore(candidate.source);
    const tagged: SportsServer[] = playable.map((s) => ({
      ...s,
      source: candidate.source,
      sourceId: candidate.sourceId,
      score: candidateServerScore(providerScore, s),
    }));
    servers.push(...tagged);
    recordProviderOutcome(candidate.source, playable[0].type === 'hls' ? 'hls' : 'iframe');

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
  // autant de providers indépendants. On garde les meilleurs candidats par
  // provider (HLS d'abord, puis score), dans la limite configurée.
  const providerServers = collectAll ? limitServersPerProvider(servers) : servers;
  const mappedServers = mapTvChannelsToMatch(target, providerServers).map((server) =>
    server.external && server.score === undefined ? { ...server, score: TV_SERVER_SCORE } : server,
  );
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
 *
 * Renvoie la promesse de collecte quand elle démarre, `null` quand les gardes
 * l'ont évitée : l'ordonnanceur de préchauffage peut ainsi borner sa
 * concurrence sans contourner les déduplications.
 */
export function warmupMatchChannels(match: SportsMatch): Promise<void> | null {
  if (collectInFlight.has(match.id)) return null;
  if (getRegisteredChannels(match.id)?.complete) return null;
  const last = lastCollectAt.get(match.id) ?? 0;
  if (Date.now() - last < COLLECT_COOLDOWN_MS) return null;

  lastCollectAt.set(match.id, Date.now());
  collectInFlight.add(match.id);
  return resolveSportsFlux(match, false, { collectAll: true })
    .then(() => undefined)
    .catch((err) => console.warn(`[sports] agrégation en arrière-plan échouée pour ${match.id}:`, err))
    .finally(() => collectInFlight.delete(match.id));
}
