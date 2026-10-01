/**
 * stream-cache.ts
 * Cache LRU en mémoire pour les résultats de résolution de stream.
 *
 * - 500 entrées max (films/épisodes les plus récemment demandés)
 * - TTL 10 minutes : suffisant pour une session de visionnage type
 * - Thread-safe (Node.js single-threaded event loop)
 *
 * En production multi-instance → remplacer par Redis (ioredis).
 */
import { LRUCache } from 'lru-cache';

export interface CachedStream {
  embedUrl: string;
  provider: string;
  /** URL directe MP4 ou HLS (si disponible depuis le scrape initial). */
  directUrl?: string;
  directType?: 'mp4' | 'hls';
  /** Indique que le contenu est inédit / pas encore sorti */
  isUnreleased?: boolean;
  releaseDate?: string;
}

const STREAM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures (rechargement instantané)

export const streamCache = new LRUCache<string, CachedStream>({
  max: 2000,
  ttl: STREAM_CACHE_TTL,
});

/** Génère une clé de cache déterministe selon le type de media. */
export function getCacheKey(
  type: 'movie' | 'episode',
  tmdbId: number,
  season?: number,
  episode?: number,
  isPremium?: boolean,
  language = 'fr',
): string {
  const tier = isPremium ? 'prem' : 'free';
  const lang = (language || 'fr').toLowerCase();
  if (type === 'movie') return `movie:${tmdbId}:${tier}:${lang}`;
  return `ep:${tmdbId}:${season ?? 0}:${episode ?? 0}:${tier}:${lang}`;
}

/** Invalide le cache pour un film/épisode (après re-scrape par ex.). */
export function invalidateCache(key: string): void {
  streamCache.delete(key);
  console.log(`[StreamCache] Cache invalidated for key: ${key}`);
}
