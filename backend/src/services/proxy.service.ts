import axios from 'axios';

export interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
  country_code: string;
  city_name: string;
}

class ProxyService {
  private apiKey: string;
  private proxies: WebshareProxy[] = [];
  private lastFetch = 0;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private roundRobinIdx = 0;

  constructor() {
    this.apiKey = process.env.WEBSHARE_API_KEY || '7y3c7z8ycmfcrhloc2gwia16m76vuhod4r487muz';
  }

  /**
   * Récupère la liste des proxys depuis Webshare API avec cache en mémoire
   */
  async getProxies(forceRefresh = false): Promise<WebshareProxy[]> {
    if (!forceRefresh && this.proxies.length > 0 && Date.now() - this.lastFetch < this.CACHE_TTL_MS) {
      return this.proxies;
    }

    try {
      const { data } = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=25', {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
        timeout: 10000,
      });

      if (data?.results && Array.isArray(data.results)) {
        this.proxies = data.results.filter((p: WebshareProxy) => p.valid !== false);
        this.lastFetch = Date.now();
        console.log(`[ProxyService] ✓ Synced ${this.proxies.length} active proxies from Webshare`);
      }
    } catch (err: any) {
      console.warn(`[ProxyService] Failed to sync proxies from Webshare API:`, err?.message || err);
      // Fallback statique si l'API Webshare est temporairement indisponible
      if (this.proxies.length === 0) {
        this.proxies = [
          { id: '1', username: 'rnpvutth', password: 'u9r4c7gvy0tx', proxy_address: '198.23.243.226', port: 6361, valid: true, country_code: 'US', city_name: 'Los Angeles' },
          { id: '2', username: 'rnpvutth', password: 'u9r4c7gvy0tx', proxy_address: '31.59.20.176', port: 6754, valid: true, country_code: 'GB', city_name: 'London' },
          { id: '3', username: 'rnpvutth', password: 'u9r4c7gvy0tx', proxy_address: '64.137.96.74', port: 6641, valid: true, country_code: 'ES', city_name: 'Madrid' },
          { id: '4', username: 'rnpvutth', password: 'u9r4c7gvy0tx', proxy_address: '31.58.9.4', port: 6077, valid: true, country_code: 'DE', city_name: 'Frankfurt' },
          { id: '5', username: 'rnpvutth', password: 'u9r4c7gvy0tx', proxy_address: '142.111.67.146', port: 5611, valid: true, country_code: 'JP', city_name: 'Tokyo' },
        ];
      }
    }

    return this.proxies;
  }

  /**
   * Retourne l'URL formatée d'un proxy (ex: http://user:pass@host:port)
   */
  getProxyUrl(proxy: WebshareProxy): string {
    return `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
  }

  /**
   * Obtient un proxy aléatoire ou via Round-Robin
   */
  async getNextProxy(countryCode?: string): Promise<string | null> {
    const list = await this.getProxies();
    if (list.length === 0) return null;

    let candidates = list;
    if (countryCode) {
      candidates = list.filter((p) => p.country_code.toUpperCase() === countryCode.toUpperCase());
      if (candidates.length === 0) candidates = list; // fallback to all
    }

    const selected = candidates[this.roundRobinIdx % candidates.length];
    this.roundRobinIdx = (this.roundRobinIdx + 1) % candidates.length;
    return this.getProxyUrl(selected);
  }

  /**
   * Obtient un proxy spécifique par pays (ex: 'US', 'GB', 'ES', 'DE', 'JP')
   */
  async getProxyForCountry(countryCode: 'US' | 'GB' | 'ES' | 'DE' | 'JP' | 'PL' | string): Promise<string | null> {
    return this.getNextProxy(countryCode);
  }

  /**
   * Configuration d'un client Axios avec proxy par pays
   */
  async getAxiosProxyConfig(countryCode?: string): Promise<any> {
    const proxyUrl = await this.getNextProxy(countryCode);
    if (!proxyUrl) return {};

    try {
      const u = new URL(proxyUrl);
      return {
        proxy: {
          protocol: 'http',
          host: u.hostname,
          port: parseInt(u.port, 10),
          auth: u.username ? { username: u.username, password: u.password } : undefined,
        },
      };
    } catch {
      return {};
    }
  }
}

export const proxyService = new ProxyService();
export default proxyService;
