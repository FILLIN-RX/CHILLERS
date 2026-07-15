import axios from 'axios';
import { StreamingProvider, StreamQuery } from './providers/provider.interface';
import { DoodStreamProvider } from './providers/doodstream.provider';
import { VidLinkProvider } from './providers/vidlink.provider';
import { VidAPIProvider } from './providers/vidapi.provider';
import { AnimeKaiProvider } from './providers/animekai.provider';

const VALIDATION_TIMEOUT = 5000;
const PROVIDER_TIMEOUT = 10000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN = 60_000;

interface ProviderAttempt {
  provider: string;
  status: 'success' | 'skip' | 'fail' | 'error';
  reason?: string;
}

interface ProviderHealth {
  consecutiveFailures: number;
  lastFailureTime: number;
  cooldownUntil: number;
}

export class ProviderManager {
  private providers: StreamingProvider[];
  private health: Map<string, ProviderHealth> = new Map();

  constructor() {
    this.providers = [
      new AnimeKaiProvider(),
      new DoodStreamProvider(),
      new VidLinkProvider(),
      new VidAPIProvider(),
    ];
  }

  async getMovieStream(query: StreamQuery): Promise<{
    provider: string;
    embedUrl: string;
  } | null> {
    const attempts: ProviderAttempt[] = [];
    const ordered = this.sortProviders(query);

    for (const provider of ordered) {
      const attempt = await this.tryProvider(provider, 'movie', query);
      attempts.push(attempt);
      if (attempt.status === 'success') {
        console.log(
          `[Stream] Movie stream found via "${provider.name}" after ${attempts.length} attempt(s)`
        );
        return { provider: attempt.provider, embedUrl: attempt.reason! };
      }
    }

    console.error(
      `[Stream] All providers failed for movie query "${query.title || query.tmdbId}":`,
      attempts.map(a => `${a.provider}=${a.status}${a.reason ? ` (${a.reason})` : ''}`).join(', ')
    );
    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<{
    provider: string;
    embedUrl: string;
  } | null> {
    const attempts: ProviderAttempt[] = [];
    const ordered = this.sortProviders(query);

    for (const provider of ordered) {
      const attempt = await this.tryProvider(provider, 'episode', query);
      attempts.push(attempt);
      if (attempt.status === 'success') {
        console.log(
          `[Stream] Episode stream found via "${provider.name}" after ${attempts.length} attempt(s)`
        );
        return { provider: attempt.provider, embedUrl: attempt.reason! };
      }
    }

    console.error(
      `[Stream] All providers failed for episode query "${query.title || query.tmdbId}" S${query.season}E${query.episode}:`,
      attempts.map(a => `${a.provider}=${a.status}${a.reason ? ` (${a.reason})` : ''}`).join(', ')
    );
    return null;
  }

  private isCircuitBroken(name: string): boolean {
    const h = this.health.get(name);
    if (!h) return false;
    if (Date.now() < h.cooldownUntil) return true;
    if (h.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      if (Date.now() - h.lastFailureTime > CIRCUIT_BREAKER_COOLDOWN) {
        this.health.delete(name);
        return false;
      }
      return true;
    }
    return false;
  }

  private recordFailure(name: string): void {
    const h = this.health.get(name) || {
      consecutiveFailures: 0,
      lastFailureTime: 0,
      cooldownUntil: 0,
    };
    h.consecutiveFailures++;
    h.lastFailureTime = Date.now();
    if (h.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      h.cooldownUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
      console.warn(
        `[Stream] Circuit breaker opened for "${name}" after ${h.consecutiveFailures} failures, cooling down for ${CIRCUIT_BREAKER_COOLDOWN / 1000}s`
      );
    }
    this.health.set(name, h);
  }

  private recordSuccess(name: string): void {
    const h = this.health.get(name);
    if (h) {
      h.consecutiveFailures = 0;
      h.cooldownUntil = 0;
    }
  }

  private async tryProvider(
    provider: StreamingProvider,
    type: 'movie' | 'episode',
    query: StreamQuery
  ): Promise<ProviderAttempt> {
    if (this.isCircuitBroken(provider.name)) {
      return {
        provider: provider.name,
        status: 'skip',
        reason: 'circuit breaker cooldown',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT);

    try {
      const result = await (type === 'movie'
        ? provider.getMovieStream(query)
        : provider.getEpisodeStream(query));

      if (!result || !result.embedUrl) {
        this.recordFailure(provider.name);
        return {
          provider: provider.name,
          status: 'fail',
          reason: 'no result returned',
        };
      }

      if (result.provider === 'doodstream') {
        this.recordSuccess(provider.name);
        return {
          provider: provider.name,
          status: 'success',
          reason: result.embedUrl,
        };
      }

      const valid = await this.validateUrl(result.embedUrl);
      if (valid) {
        this.recordSuccess(provider.name);
        return {
          provider: provider.name,
          status: 'success',
          reason: result.embedUrl,
        };
      }

      this.recordFailure(provider.name);
      return {
        provider: provider.name,
        status: 'fail',
        reason: 'URL validation failed',
      };
    } catch (err: any) {
      this.recordFailure(provider.name);
      const msg = err?.name === 'AbortError'
        ? `timeout (${PROVIDER_TIMEOUT}ms)`
        : err?.message || 'unknown error';
      return {
        provider: provider.name,
        status: 'error',
        reason: msg,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sortProviders(query: StreamQuery): StreamingProvider[] {
    const supports: StreamingProvider[] = [];
    const fallback: StreamingProvider[] = [];

    for (const p of this.providers) {
      if (p.supports(query)) {
        supports.push(p);
      } else {
        fallback.push(p);
      }
    }

    return [...supports, ...fallback];
  }

  private async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await axios.get(url, {
        timeout: VALIDATION_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.status >= 400) return false;

      const body = typeof response.data === 'string' ? response.data.toLowerCase() : '';
      const notFoundIndicators = [
        'not found',
        'unavailable',
        'error loading',
        'no stream',
        'content not available',
        '404',
        'introuvable',
        'indisponible',
        'erreur',
        'non disponible',
        'aucun contenu',
        'n\'existe pas',
      ];

      for (const indicator of notFoundIndicators) {
        if (body.includes(indicator)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}
