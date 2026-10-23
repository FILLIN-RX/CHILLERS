/**
 * Registre des chaînes d'un match : mémorise la liste complète des serveurs
 * résolus (tous providers confondus) pour servir les appels suivants
 * instantanément.
 *
 * Décision d'architecture : on ne stocke JAMAIS les URLs brutes du site.
 * 46 % des liens récoltés (dont 100 % des chaînes connues beIN/TNT) portent un
 * jeton de 1 à 7 h (kora `frame.php?token=<uuid>`, liveball JWT, kooorah `?e=`)
 * : stockés tels quels, ils sont morts au moment où on les relit. Le registre
 * garde donc les serveurs déjà sondés jouables, à revalider à la volée — et la
 * résolution complète reste possible si le cache est froid.
 *
 * Pas de MongoDB : cache mémoire. Les liens peuvent contenir des jetons courts,
 * donc le registre reste bref et la chaîne renouvelle les sources ensuite.
 */
import { LRUCache } from 'lru-cache';
import type { SportsServer, SportsSourceId } from './sports.types';

/** Agrégation de secours active par défaut ; SPORTS_MULTI_SERVER=0 la désactive. */
export const MULTI_SERVER_ENABLED = !['0', 'false'].includes(
  (process.env.SPORTS_MULTI_SERVER || '').trim().toLowerCase(),
);

const CHANNELS_TTL = 2 * 60 * 1000; // 2 minutes (liens signés / lecteurs temporaires)

export interface RegisteredChannels {
  /** Source ayant servi le premier serveur (le flux principal du match). */
  source: SportsSourceId;
  sourceId: string;
  servers: SportsServer[];
  /** true = la boucle de providers a été épuisée (résultat exhaustif). */
  complete: boolean;
  ts: number;
}

export const matchChannelsCache = new LRUCache<string, RegisteredChannels>({
  max: 500,
  ttl: CHANNELS_TTL,
});

export function rememberChannels(matchId: string, entry: Omit<RegisteredChannels, 'ts'>): void {
  matchChannelsCache.set(matchId, { ...entry, ts: Date.now() });
}

export function getRegisteredChannels(matchId: string): RegisteredChannels | undefined {
  return matchChannelsCache.get(matchId);
}

export function forgetChannels(matchId: string): void {
  matchChannelsCache.delete(matchId);
}
