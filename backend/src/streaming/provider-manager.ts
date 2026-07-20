import axios from 'axios';
import { exec } from 'child_process';
import path from 'path';
import { StreamingProvider, StreamQuery } from './providers/provider.interface';
import { MongoDBProvider } from './providers/mongodb.provider';
import { DoodStreamProvider } from './providers/doodstream.provider';
import { VidAPIProvider } from './providers/vidapi.provider';
import { AnimeKaiProvider } from './providers/animekai.provider';
import { OtakuProvider } from './providers/otaku.provider';
import { VidLinkProvider } from './providers/vidlink.provider';

const VALIDATION_TIMEOUT = 5000;
const PROVIDER_TIMEOUT = 10000;
const OTAKU_TIMEOUT = 25000;
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
    // Ordre de priorité: MongoDB (liens stockés), Doodstream, Otaku, Autres...
    this.providers = [
      new MongoDBProvider(),
      new DoodStreamProvider(),
      new OtakuProvider(),
      new AnimeKaiProvider(),
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
    const timeout = provider.name === 'otaku' ? OTAKU_TIMEOUT : PROVIDER_TIMEOUT;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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

      // Skip validation for MongoDB — URLs already stored in our DB
      const valid = provider.name === 'mongodb' || await this.validateUrl(result.embedUrl);
      
      if (valid) {
        this.recordSuccess(provider.name);
        return {
          provider: provider.name,
          status: 'success',
          reason: result.embedUrl,
        };
      } else {
        this.recordFailure(provider.name);
        
        // TRIGGER BACKGROUND RE-SCRAPE
        console.log(`[Self-Healing] Triggering background re-scrape for: ${provider.name} - ${query.title}`);
        const scriptPath = path.join(__dirname, '../scraping/core/on-demand-fetch.ts');
        const typeArg = type === 'movie' ? 'movie' : 'series';
        exec(`npx tsx ${scriptPath} "${query.title}" "${typeArg}" "${query.episode || ''}"`);

        return {
          provider: provider.name,
          status: 'fail',
          reason: 'URL validation failed, re-scraping triggered',
        };
      }
    } catch (err: any) {
      this.recordFailure(provider.name);
      const msg = err?.name === 'AbortError'
        ? `timeout (${timeout}ms)`
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
    // Skip validation for Doodstream/Playmogo embeds since they are protected by Cloudflare/DDOS-GUARD
    if (
      url.includes('doodstream.com/e/') ||
      url.includes('playmogo.com/e/') ||
      url.includes('dood.to/e/') ||
      url.includes('dood.sh/e/') ||
      url.includes('dood.so/e/') ||
      url.includes('dood.cx/e/') ||
      url.includes('dood.la/e/') ||
      url.includes('dood.wf/e/') ||
      url.includes('dood.pm/e/')
    ) {
      return true;
    }

    try {
      // 1. Try a HEAD request first to verify video URLs quickly without downloading body
      try {
        const headResponse = await axios.head(url, {
          timeout: VALIDATION_TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          maxRedirects: 5,
        });

        if (headResponse.status >= 200 && headResponse.status < 400) {
          const contentType = headResponse.headers['content-type'] || '';
          if (
            contentType.includes('video/') ||
            contentType.includes('application/x-mpegurl') ||
            contentType.includes('application/vnd.apple.mpegurl')
          ) {
            return true;
          }
        }
      } catch (headErr) {
        // HEAD failed, fall back to GET stream
      }

      // 2. Perform GET request with stream response to inspect headers / small body chunk
      const response = await axios.get(url, {
        timeout: VALIDATION_TIMEOUT,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        maxRedirects: 5,
      });

      if (response.status >= 400) {
        response.data.destroy();
        return false;
      }

      const contentType = (response.headers['content-type'] || '').toLowerCase();
      if (
        contentType.includes('video/') ||
        contentType.includes('application/x-mpegurl') ||
        contentType.includes('application/vnd.apple.mpegurl')
      ) {
        response.data.destroy();
        return true;
      }

      // If it is HTML, read the first 50KB to check for error indicators
      return new Promise<boolean>((resolve) => {
        let body = '';
        const stream = response.data;

        stream.on('data', (chunk: any) => {
          body += chunk.toString('utf8');
          if (body.length > 50000) {
            stream.destroy();
          }
        });

        stream.on('end', () => {
          resolve(this.checkBodyForErrors(body, url));
        });

        stream.on('error', () => {
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  private checkBodyForErrors(body: string, url: string): boolean {
    const text = body.toLowerCase();
    if (text.length < 200) return false;

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
      'this video is not available',
      'video not found',
      'no video',
      'content unavailable',
      'stream not found',
      'sorry',
      'page not found',
      'file not found',
      'nothing found',
      'aucun résultat',
      'ne correspond',
      'page introuvable',
      'fichier introuvable',
      'contenu non trouvé',
      'film introuvable',
      'série introuvable',
      'nothing here',
      'no content',
      'empty',
      'error 404',
      'error 500',
    ];

    for (const indicator of notFoundIndicators) {
      if (text.includes(indicator)) {
        return false;
      }
    }

    if (url.includes('vidlink.pro')) {
      if (
        !text.includes('vidlink') &&
        !text.includes('player') &&
        !text.includes('video') &&
        !text.includes('iframe')
      ) {
        return false;
      }
    }

    return true;
  }
}
