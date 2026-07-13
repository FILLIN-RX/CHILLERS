import { StreamingProvider, StreamResult, StreamQuery } from './provider.interface';

const BASE_URL = 'https://animekai.to';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export class AnimeKaiProvider implements StreamingProvider {
  readonly name = 'animekai';

  supports(query: StreamQuery): boolean {
    return query.type === 'anime' && !!query.title;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.title) return null;
    const slug = slugify(query.title);
    const embedUrl = `${BASE_URL}/embed/${slug}`;
    return { provider: this.name, embedUrl, type: 'movie' };
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    if (!query.title) return null;
    const slug = slugify(query.title);
    const ep = query.episode || 1;
    const embedUrl = `${BASE_URL}/embed/${slug}?ep=${ep}`;
    return { provider: this.name, embedUrl, type: 'episode' };
  }
}
