import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { searchOtaku } from '../../modules/otaku/otaku.service';

function formatOtakuStream(result: { titre: string; lien: string; source: 'otaku' }, type: 'movie' | 'episode'): StreamResult {
  const isDirectStream = /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(result.lien) || /u\d+\.vidzy\.cc|v\d+\.vidzy\.cc/i.test(result.lien);
  const referer = 'https://vidzy.cc/';
  const embedUrl = isDirectStream
    ? `/api/doodstream/stream?url=${encodeURIComponent(result.lien)}&referer=${encodeURIComponent(referer)}`
    : result.lien;

  return {
    provider: 'otaku',
    embedUrl,
    directUrl: isDirectStream ? result.lien : undefined,
    directType: isDirectStream ? (/\.(m3u8)/i.test(result.lien) ? 'hls' : 'mp4') : undefined,
    type,
  };
}

export class OtakuProvider implements StreamingProvider {
  readonly name = 'otaku';

  supports(query: StreamQuery): boolean {
    return !!query.title;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.title) return null;

    console.log(`[Otaku] Searching movie: "${query.title}" (year=${query.year || 'non spécifiée'}, lang=${query.language || 'fr'})`);
    const result = await searchOtaku(query.title, 'movie', undefined, undefined, query.language || 'fr', query.year);

    if (result?.lien) {
      console.log(`[Otaku] Found movie link: ${result.lien.slice(0, 80)}...`);
      return formatOtakuStream(result, 'movie');
    }

    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.title) return null;

    console.log(`[Otaku] Searching series: "${query.title}" S${query.season}E${query.episode} (lang=${query.language || 'fr'})`);
    const result = await searchOtaku(query.title, 'series', query.season, query.episode, query.language || 'fr');

    if (result?.lien) {
      console.log(`[Otaku] Found series link: ${result.lien.slice(0, 80)}...`);
      return formatOtakuStream(result, 'episode');
    }

    return null;
  }
}

