import ProviderCatalogItem from '../../../models/ProviderCatalogItem';
import { fetchW16AnimePayload } from '../../catalog/w16-anime-source';
import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';

/** Résout les épisodes du catalogue French Anime (W16) lié au catalogue TMDB. */
export class FrenchAnimeProvider implements StreamingProvider {
  readonly name = 'frenchanime';

  supports(query: StreamQuery): boolean {
    return Boolean(query.tmdbId && (query.type === 'anime' || query.type === 'tv'));
  }

  async getMovieStream(_query: StreamQuery): Promise<StreamResult | null> {
    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    const season = Number(query.season || 1);
    const episode = Number(query.episode || 1);
    const items = await ProviderCatalogItem.find({
      provider: 'otaku', // Le catalogue W16 existant partage l'index anime Otaku.
      type: 'anime',
      tmdbId: query.tmdbId,
      active: true,
      matchStatus: 'matched',
      'card.media_type': 'tv',
      'card.genre_ids': 16,
    })
      .select('sourceId title season pageUrl language')
      .lean();

    const item = items.find((entry: any) => Number(entry.season || 1) === season);
    if (!item) {
      console.log(`[French Anime] Aucun catalogue lié à TMDB ${query.tmdbId} S${season}`);
      return null;
    }

    const payload = await fetchW16AnimePayload(item.sourceId);
    const sourceEpisode = payload?.episodes?.[String(episode)]
      || payload?.episodes?.[String(episode).padStart(2, '0')];
    if (!sourceEpisode?.links.length) {
      console.log(`[French Anime] Épisode S${season}E${episode} absent de « ${item.title} » (${item.sourceId})`);
      return null;
    }

    const wantedLanguage = (query.language || 'fr').toLowerCase();
    const preferred = wantedLanguage === 'vostfr'
      ? ['VOSTFR', 'VF']
      : ['VF', 'VOSTFR'];
    const link = preferred.flatMap((language) => sourceEpisode.links.filter((candidate) => candidate.language === language))[0];
    if (!link) return null;

    console.log(`[French Anime] Flux ${link.language} trouvé pour « ${item.title} » S${season}E${episode} (${link.host})`);
    return {
      provider: this.name,
      embedUrl: link.url,
      type: 'episode',
      language: link.language,
      referer: `${new URL(item.pageUrl).origin}/`,
    };
  }
}
