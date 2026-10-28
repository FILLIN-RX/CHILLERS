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
  /**
   * Identifiant neutle pour l'URL (`/live/sp/<slug>`) : le `sourceId` lisible
   * s'il est unique dans la liste fusionnée, sinon un hash de la rencontre.
   * Aucun nom de provider dans le routing.
   */
  slug?: string;
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
  /**
   * Page qui embarque ce lecteur. Beaucoup d'hôtes sont « domain protected » :
   * sans ce Referer, ils répondent une page d'erreur au lieu du flux.
   */
  referer?: string;
  /**
   * Source et identifiant d'origine de ce serveur précis. Un match peut être
   * servi par plusieurs providers (les jumeaux d'une même rencontre) : c'est ce
   * couple qui permet de reconstruire le relay HLS d'un serveur venu d'une
   * autre source que celle du match affiché.
   */
  source?: SportsSourceId;
  sourceId?: string;
  /** Flux TV indépendant du provider du match (ex. chaîne issue du snapshot IPTV). */
  external?: boolean;
  /**
   * Probabilité estimée (0..1) que ce serveur réponde au prochain essai :
   * fiabilité historique du provider, bonus HLS, sonde fraîche. C'est la clé de
   * tri du sélecteur de sources côté client.
   */
  score?: number;
  /**
   * Relay HLS déjà construit (fast path lab) : surcharge le relay générique
   * `source/sourceId` quand le lien vient du snapshot et non de la chaîne.
   */
  relayUrl?: string;
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
