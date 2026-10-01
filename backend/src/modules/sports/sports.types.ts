/**
 * Types partagés du module sports (sources de foot additionnelles à LiveBall).
 *
 * Ces sources agrègent plusieurs sites publics (kora-api, kooorah, yallapro,
 * streamiz) derrière un contrat unique : une liste de matchs normalisée et une
 * résolution de flux renvoyant soit un HLS, soit un player à embarquer.
 */

export type SportsSourceId = 'liveball' | 'kora' | 'kooorah' | 'yallapro' | 'streamiz';

export interface SportsMatch {
  /** Identifiant stable, unique au sein de la source (`${source}:${id}`). */
  id: string;
  /** Identifiant brut de la source (numérique pour kora/kooorah, slug sinon). */
  sourceId: string;
  source: SportsSourceId;
  status: 'live' | 'upcoming';
  home: string;
  /** Vide quand la source ne publie qu'un libellé de canal (ex. yallapro). */
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  league?: string;
  score?: string;
  /** Timestamp epoch (secondes) de la coupure d'envoi. */
  startTs?: number;
}

export interface SportsServer {
  name: string;
  url: string;
  /**
   * Type de ce serveur précis. Une même chaîne peut proposer un player à
   * embarquer sur un serveur et un HLS natif sur un autre (cas yallapro) : le
   * type global n'est alors plus suffisant pour le switch côté client.
   */
  type?: 'hls' | 'iframe';
}

/**
 * Flux résolu. `hls` est joué par LivePlayer via notre relay, `iframe` est
 * embarqué tel quel (la plupart des sources ne livrent qu'un player).
 */
export interface ResolvedSportsStream {
  url: string;
  type: 'hls' | 'iframe';
  /** Tous les serveurs/mirrors proposés par la source, pour le switch client. */
  servers: SportsServer[];
}

export const SPORTS_SOURCES: SportsSourceId[] = ['liveball', 'kora', 'kooorah', 'yallapro', 'streamiz'];
