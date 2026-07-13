import axios from 'axios';
import { StreamingProvider, StreamQuery } from './providers/provider.interface';
import { VidLinkProvider } from './providers/vidlink.provider';
import { VidAPIProvider } from './providers/vidapi.provider';
import { AnimeKaiProvider } from './providers/animekai.provider';

const VALIDATION_TIMEOUT = 5000;

export class ProviderManager {
  private providers: StreamingProvider[];

  constructor() {
    this.providers = [
      new AnimeKaiProvider(),
      new VidLinkProvider(),
      new VidAPIProvider(),
    ];
  }

  async getMovieStream(query: StreamQuery): Promise<{ provider: string; embedUrl: string } | null> {
    const ordered = this.sortProviders(query);
    for (const provider of ordered) {
      try {
        const result = await provider.getMovieStream(query);
        if (result && result.embedUrl) {
          const valid = await this.validateUrl(result.embedUrl);
          if (valid) {
            return { provider: result.provider, embedUrl: result.embedUrl };
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async getEpisodeStream(query: StreamQuery): Promise<{ provider: string; embedUrl: string } | null> {
    const ordered = this.sortProviders(query);
    for (const provider of ordered) {
      try {
        const result = await provider.getEpisodeStream(query);
        if (result && result.embedUrl) {
          const valid = await this.validateUrl(result.embedUrl);
          if (valid) {
            return { provider: result.provider, embedUrl: result.embedUrl };
          }
        }
      } catch {
        continue;
      }
    }
    return null;
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
      const response = await axios.head(url, {
        timeout: VALIDATION_TIMEOUT,
        validateStatus: (status) => status < 500,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      return response.status < 400;
    } catch {
      return false;
    }
  }
}
