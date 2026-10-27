import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import {
  fetchOhaEpisodeSources,
  fetchOhaMovieSources,
  probeOhaVod,
  resolveOhaVod,
  selectOhaVodSources,
  type OhaVodSource,
} from '../oha-vod.client';
import { buildOhaRelayUrl } from '../oha-hls-relay';

const MAX_CANDIDATES = 6;
const FIRST_SUCCESS_TIMEOUT = 20_000;

function firstSuccess<T>(tasks: Array<Promise<T | null>>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    if (!tasks.length) {
      resolve(null);
      return;
    }
    let pending = tasks.length;
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    for (const task of tasks) {
      task
        .then((value) => {
          if (value) finish(value);
        })
        .catch(() => {})
        .finally(() => {
          pending--;
          if (pending === 0) finish(null);
        });
    }
  });
}

export class OhaProvider implements StreamingProvider {
  readonly name = 'oha';

  supports(query: StreamQuery): boolean {
    return !!query.tmdbId;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.tmdbId) return null;
    const language = (query.language || 'fr').toLowerCase();
    const sources = await fetchOhaMovieSources(query.tmdbId);
    return this.resolveCandidates(sources, language, 'movie', query);
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.tmdbId || query.season === undefined || query.episode === undefined) return null;
    const language = (query.language || 'fr').toLowerCase();
    const sources = await fetchOhaEpisodeSources(query.tmdbId, query.season, query.episode);
    return this.resolveCandidates(sources, language, 'episode', query);
  }

  private resolveCandidates(
    sources: OhaVodSource[],
    language: string,
    type: 'movie' | 'episode',
    query: StreamQuery,
  ): Promise<StreamResult | null> {
    const candidates = selectOhaVodSources(sources, language).slice(0, MAX_CANDIDATES);
    if (!candidates.length) return Promise.resolve(null);

    const tasks = candidates.map((source) => this.resolveSource(source, language, type, query));
    return firstSuccess(tasks, FIRST_SUCCESS_TIMEOUT);
  }

  private async resolveSource(
    source: OhaVodSource,
    language: string,
    type: 'movie' | 'episode',
    query: StreamQuery,
  ): Promise<StreamResult | null> {
    const resolved = await resolveOhaVod(source.url);
    if (!resolved) return null;

    const directType = (await probeOhaVod(resolved))
      ?? (resolved.format === 'hls' ? 'hls' : null);
    if (!directType) return null;

    const directUrl = buildOhaRelayUrl(resolved, source.url, directType);
    console.log(
      `[OHA] ${type === 'movie' ? 'Film' : 'Épisode'} ${query.tmdbId}${type === 'episode' ? ` S${query.season}E${query.episode}` : ''} → ${directType} (${language.toUpperCase()}, ${source.name || source.url})`,
    );

    return {
      provider: this.name,
      embedUrl: source.url,
      type,
      directUrl,
      directType,
      quality: source.quality,
      language,
    };
  }
}
