import axios from 'axios';
import { LRUCache } from 'lru-cache';

const ESPN_HOSTS = [
  'https://site.api.espn.com',
  'https://site.web.api.espn.com',
];

const RAW_API_CACHE = new LRUCache<string, any>({
  max: 300,
  ttl: 20_000, // 20s
});

export class EspnClient {
  /**
   * Effectue un appel GET résilient vers l'API ESPN
   */
  static async fetchJson<T = any>(
    pathOrUrl: string,
    options: { timeout?: number; ttl?: number; cache?: boolean } = {}
  ): Promise<T | null> {
    const { timeout = 8000, ttl, cache = true } = options;
    const cacheKey = `espn_${pathOrUrl}`;

    if (cache && RAW_API_CACHE.has(cacheKey)) {
      return RAW_API_CACHE.get(cacheKey) as T;
    }

    const isAbsolute = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://');

    if (isAbsolute) {
      try {
        const res = await axios.get<T>(pathOrUrl, {
          timeout,
          headers: { Accept: 'application/json' },
          family: 4,
        });
        if (res.data) {
          if (cache) RAW_API_CACHE.set(cacheKey, res.data, { ttl });
          return res.data;
        }
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        console.warn(`[EspnClient] Erreur sur ${pathOrUrl}:`, err.message);
        return null;
      }
    }

    // Basculement sur les domaines ESPN
    for (const host of ESPN_HOSTS) {
      const fullUrl = `${host}${pathOrUrl}`;
      try {
        const res = await axios.get<T>(fullUrl, {
          timeout,
          headers: { Accept: 'application/json' },
          family: 4,
        });
        if (res.data) {
          if (cache) RAW_API_CACHE.set(cacheKey, res.data, { ttl });
          return res.data;
        }
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        // Continue to fallback host
      }
    }

    return null;
  }
}
