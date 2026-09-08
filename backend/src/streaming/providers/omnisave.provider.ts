import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { searchOmniSave, getOmniSaveDownloads } from '../../modules/omnisave/omnisave.service';
import tmdbClient from '../../config/tmdb';

export class OmniSaveProvider implements StreamingProvider {
  readonly name = 'omnisave';

  supports(query: StreamQuery): boolean {
    return !!(query.title || query.tmdbId);
  }

  private async resolveTitles(query: StreamQuery): Promise<string[]> {
    const titles = new Set<string>();
    if (query.title) titles.add(query.title);

    if (query.tmdbId) {
      try {
        const endpoint = query.type === 'tv' || query.type === 'anime' ? `/tv/${query.tmdbId}` : `/movie/${query.tmdbId}`;
        const { data } = await tmdbClient.get(`${endpoint}?language=${query.language || 'fr'}`);
        if (data?.title) titles.add(data.title);
        if (data?.name) titles.add(data.name);
        if (data?.original_title) titles.add(data.original_title);
        if (data?.original_name) titles.add(data.original_name);
      } catch (_) {}
    }
    return Array.from(titles);
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    const candidateTitles = await this.resolveTitles(query);
    if (candidateTitles.length === 0) return null;

    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normalizedTargets = candidateTitles.map(t => normalize(t));

    for (const title of candidateTitles) {
      try {
        console.log(`[OmniSave Provider] Recherche film: "${title}"`);
        const searchRes = await searchOmniSave(title, 1, 5);
        if (!searchRes.items || searchRes.items.length === 0) continue;

        const matchedItem = searchRes.items.find(it => {
          const itemClean = normalize(it.title);
          return normalizedTargets.includes(itemClean);
        });

        if (!matchedItem) {
          console.log(`[OmniSave Provider] Aucun titre correspondant à "${title}" (trouvés: ${searchRes.items.map(i => i.title).join(', ')})`);
          continue;
        }

        const item = matchedItem;
        const dlRes = await getOmniSaveDownloads(item.subjectId, item.detailPath, 1, 1);

        const available = dlRes.downloads
          .filter(d => !d.vipLocked && d.url)
          .sort((a, b) => b.resolution - a.resolution);

        if (available.length > 0) {
          const best = available[0];
          console.log(`[OmniSave Provider] Flux trouvé (${best.resolution}p): ${best.url.slice(0, 60)}...`);
          return {
            provider: this.name,
            embedUrl: `/api/omnisave/proxy?url=${encodeURIComponent(best.url)}`,
            type: 'movie'
          };
        }
      } catch (error: any) {
        console.error(`[OmniSave Provider] Erreur film "${title}":`, error.message);
      }
    }
    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const candidateTitles = await this.resolveTitles(query);
    if (candidateTitles.length === 0) return null;

    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normalizedTargets = candidateTitles.map(t => normalize(t));

    const season = query.season || 1;
    const episode = query.episode || 1;

    for (const title of candidateTitles) {
      try {
        console.log(`[OmniSave Provider] Recherche série/anime: "${title}" S${season}E${episode}`);

        const searchRes = await searchOmniSave(title, 1, 5);
        if (!searchRes.items || searchRes.items.length === 0) continue;

        const matchedItem = searchRes.items.find(it => {
          const itemClean = normalize(it.title);
          return normalizedTargets.includes(itemClean);
        });

        if (!matchedItem) {
          console.log(`[OmniSave Provider] Aucun titre correspondant pour série "${title}"`);
          continue;
        }

        const item = matchedItem;
        const dlRes = await getOmniSaveDownloads(item.subjectId, item.detailPath, season, episode);

        const available = dlRes.downloads
          .filter(d => !d.vipLocked && d.url)
          .sort((a, b) => b.resolution - a.resolution);

        if (available.length > 0) {
          const best = available[0];
          console.log(`[OmniSave Provider] Épisode trouvé (${best.resolution}p): ${best.url.slice(0, 60)}...`);
          return {
            provider: this.name,
            embedUrl: `/api/omnisave/proxy?url=${encodeURIComponent(best.url)}`,
            type: 'episode'
          };
        }
      } catch (error: any) {
        console.error(`[OmniSave Provider] Erreur épisode "${title}":`, error.message);
      }
    }
    return null;
  }
}
