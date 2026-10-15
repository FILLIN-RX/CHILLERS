import axios from 'axios';
import { LRUCache } from 'lru-cache';
import { getSportsMatches, resolveSportsFlux } from '../sports/sports.service';
import {
  SportMatch,
  MatchStatus,
  MatchLeague,
  MatchTeam,
  MatchesFilterOptions,
  PosterFixture,
  SportType,
  MatchSummary,
  TeamBoxscore,
  TeamRoster,
  MatchKeyEvent,
  MatchPlayer,
} from './matches.types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MATCHES_CACHE = new LRUCache<string, SportMatch[]>({
  max: 100,
  ttl: 30_000, // 30s cache for fast real-time scoreboard updates
});

const SUMMARY_CACHE = new LRUCache<string, MatchSummary>({
  max: 100,
  ttl: 15_000, // 15s cache pour les détails complets (boxscore, compos, stats)
});

const POSTER_CACHE = new LRUCache<string, PosterFixture[]>({
  max: 12,
  // Compétitions et écussons ne varient pas à la seconde ; une journée de
  // matchs se suffit à elle-même.
  ttl: 10 * 60_000,
});

/**
 * Le flux mondial `soccer/all/scoreboard` ne publie AUCUNE information de
 * ligue (event.league = null sur 100% des événements) : sans résolution, tous
 * les matchs arrivent étiquetés « Football » et la vitrine « grandes
 * compétitions » les écarte. On récupère la ligue via `summary?event=`
 * (header.league), une seule fois par ligue puis mémorisé 24h.
 */
interface ResolvedLeague {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
}

// Enveloppe non-nulle : lru-cache refuse `null` comme valeur, et on veut
// quand même mémoriser les échecs de résolution (sinon on re-fetch à l'infini).
const LEAGUE_BY_NUMERIC_ID = new LRUCache<string, { league: ResolvedLeague | null }>({
  max: 300,
  ttl: 24 * 60 * 60_000,
});
const LEAGUE_RESOLVE_INFLIGHT = new Map<string, Promise<ResolvedLeague | null>>();

/** `s:600~l:776~e:401915573` → `776` (identifiant numérique de ligue ESPN). */
function numericLeagueId(event: any): string | null {
  const uid = String(event?.uid || '');
  const m = uid.match(/~l:(\d+)~/);
  return m ? m[1] : null;
}

/** Réunit l'identité de la ligue d'un événement du flux mondial (concurrence limitée). */
async function resolveLeaguesForEvents(events: any[]): Promise<void> {
  const byNumeric = new Map<string, any>();
  for (const ev of events) {
    if (ev?.league) continue; // déjà étiqueté par la source
    const num = numericLeagueId(ev);
    if (!num || LEAGUE_BY_NUMERIC_ID.has(num) || byNumeric.has(num)) continue;
    byNumeric.set(num, ev);
  }
  if (byNumeric.size === 0) return;

  const jobs = Array.from(byNumeric.entries());
  const WORKERS = 6;
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const [num, ev] = jobs[cursor++];
      let pending = LEAGUE_RESOLVE_INFLIGHT.get(num);
      if (!pending) {
        pending = (async (): Promise<ResolvedLeague | null> => {
          try {
            const { data } = await axios.get(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${ev.id}`,
              { headers: { 'User-Agent': USER_AGENT }, timeout: 8000, responseType: 'json' }
            );
            const lg = data?.header?.league;
            if (!lg?.slug) throw new Error('header.league absent');
            return {
              id: String(lg.id ?? ''),
              slug: String(lg.slug),
              name: String(lg.name || lg.slug),
              logo: lg.logos?.[0]?.href || null,
            };
          } catch {
            return null;
          } finally {
            LEAGUE_RESOLVE_INFLIGHT.delete(num);
          }
        })();
        LEAGUE_RESOLVE_INFLIGHT.set(num, pending);
      }
      const resolved = await pending;
      LEAGUE_BY_NUMERIC_ID.set(num, { league: resolved });
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, jobs.length) }, () => worker()));
}

const LEAGUES_CONFIG: Array<{ id: string; slug: string; name: string; sport: SportType; espnLeague: string; logo: string; country: string }> = [
  {
    id: 'uefa.champions',
    slug: 'champions-league',
    name: 'Ligue des Champions',
    sport: 'football',
    espnLeague: 'uefa.champions',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
    country: 'Europe',
  },
  {
    id: 'eng.1',
    slug: 'premier-league',
    name: 'Premier League',
    sport: 'football',
    espnLeague: 'eng.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png',
    country: 'Angleterre',
  },
  {
    id: 'esp.1',
    slug: 'la-liga',
    name: 'LaLiga',
    sport: 'football',
    espnLeague: 'esp.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/15.png',
    country: 'Espagne',
  },
  {
    id: 'fra.1',
    slug: 'ligue-1',
    name: 'Ligue 1',
    sport: 'football',
    espnLeague: 'fra.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/9.png',
    country: 'France',
  },
  {
    id: 'ita.1',
    slug: 'serie-a',
    name: 'Serie A',
    sport: 'football',
    espnLeague: 'ita.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/12.png',
    country: 'Italie',
  },
  {
    id: 'ger.1',
    slug: 'bundesliga',
    name: 'Bundesliga',
    sport: 'football',
    espnLeague: 'ger.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/10.png',
    country: 'Allemagne',
  },
  {
    id: 'uefa.europa',
    slug: 'europa-league',
    name: 'Ligue Europa',
    sport: 'football',
    espnLeague: 'uefa.europa',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
    country: 'Europe',
  },
  {
    id: 'uefa.nations',
    slug: 'uefa-nations',
    name: 'UEFA Nations League',
    sport: 'football',
    espnLeague: 'uefa.nations',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2034.png',
    country: 'Europe',
  },
  {
    // ESPN a renommé la ligue : l'ancien id `sau.1` renvoie désormais 400,
    // ce qui vidait silencieusement l'onglet Arabie saoudite.
    id: 'ksa.1',
    slug: 'saudi-league',
    name: 'Saudi Pro League',
    sport: 'football',
    espnLeague: 'ksa.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png',
    country: 'Arabie Saoudite',
  },
  {
    id: 'usa.1',
    slug: 'mls',
    name: 'Major League Soccer',
    sport: 'football',
    espnLeague: 'usa.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/19.png',
    country: 'USA',
  },
  {
    id: 'conmebol.libertadores',
    slug: 'copa-libertadores',
    name: 'Copa Libertadores',
    sport: 'football',
    espnLeague: 'conmebol.libertadores',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2676.png',
    country: 'Amérique du Sud',
  },
  {
    id: 'conmebol.sudamericana',
    slug: 'copa-sudamericana',
    name: 'Copa Sudamericana',
    sport: 'football',
    espnLeague: 'conmebol.sudamericana',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/1208.png',
    country: 'Amérique du Sud',
  },
  {
    id: 'afc.champions',
    slug: 'afc-champions-league',
    name: 'Ligue des Champions d\'Asie',
    sport: 'football',
    espnLeague: 'afc.champions',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2200.png',
    country: 'Asie',
  },
  {
    id: 'caf.champions',
    slug: 'caf-champions-league',
    name: 'Ligue des Champions d\'Afrique',
    sport: 'football',
    espnLeague: 'caf.champions',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2391.png',
    country: 'Afrique',
  },
  {
    id: 'caf.nations',
    slug: 'africa-cup-of-nations',
    name: 'Coupe d\'Afrique des Nations',
    sport: 'football',
    espnLeague: 'caf.nations',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/76.png',
    country: 'Afrique',
  },
  {
    id: 'uefa.europa.conf',
    slug: 'conference-league',
    name: 'UEFA Conference League',
    sport: 'football',
    espnLeague: 'uefa.europa.conf',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png',
    country: 'Europe',
  },
  {
    id: 'tur.1',
    slug: 'super-lig',
    name: 'Super Lig',
    sport: 'football',
    espnLeague: 'tur.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/18.png',
    country: 'Turquie',
  },
  {
    id: 'por.1',
    slug: 'primeira-liga',
    name: 'Liga Portugal',
    sport: 'football',
    espnLeague: 'por.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/14.png',
    country: 'Portugal',
  },
  {
    id: 'ned.1',
    slug: 'eredivisie',
    name: 'Eredivisie',
    sport: 'football',
    espnLeague: 'ned.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/11.png',
    country: 'Pays-Bas',
  },
  {
    id: 'bel.1',
    slug: 'pro-league',
    name: 'Pro League',
    sport: 'football',
    espnLeague: 'bel.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/6.png',
    country: 'Belgique',
  },
  {
    id: 'gre.1',
    slug: 'super-league',
    name: 'Super League Grèce',
    sport: 'football',
    espnLeague: 'gre.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/98.png',
    country: 'Grèce',
  },
  {
    id: 'aut.1',
    slug: 'bundesliga-austria',
    name: 'Bundesliga Autriche',
    sport: 'football',
    espnLeague: 'aut.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/5.png',
    country: 'Autriche',
  },
  {
    id: 'sco.1',
    slug: 'scottish-premiership',
    name: 'Scottish Premiership',
    sport: 'football',
    espnLeague: 'sco.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/45.png',
    country: 'Écosse',
  },
  {
    id: 'arg.1',
    slug: 'liga-profesional',
    name: 'Liga Profesional',
    sport: 'football',
    espnLeague: 'arg.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/1.png',
    country: 'Argentine',
  },
  {
    id: 'bra.1',
    slug: 'brasileirao',
    name: 'Série A Brésil',
    sport: 'football',
    espnLeague: 'bra.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/85.png',
    country: 'Brésil',
  },
  {
    id: 'mex.1',
    slug: 'liga-mx',
    name: 'Liga MX',
    sport: 'football',
    espnLeague: 'mex.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/22.png',
    country: 'Mexique',
  },
  {
    id: 'col.1',
    slug: 'liga-aguila',
    name: 'Liga Águila',
    sport: 'football',
    espnLeague: 'col.1',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/1543.png',
    country: 'Colombie',
  },
  {
    id: 'concacaf.champions_cup',
    slug: 'concacaf-champions-cup',
    name: 'CONCACAF Champions Cup',
    sport: 'football',
    espnLeague: 'concacaf.champions_cup',
    logo: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/default-team-logo-500.png&w=100&h=100',
    country: 'Concacaf',
  },
  {
    id: 'fifa.world',
    slug: 'fifa-world-cup',
    name: 'Coupe du Monde',
    sport: 'football',
    espnLeague: 'fifa.world',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/4.png',
    country: 'Monde',
  },
  {
    id: 'eng.fa',
    slug: 'fa-cup',
    name: 'FA Cup',
    sport: 'football',
    espnLeague: 'eng.fa',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/40.png',
    country: 'Angleterre',
  },
  {
    id: 'eng.league_cup',
    slug: 'league-cup',
    name: 'Carabao Cup',
    sport: 'football',
    espnLeague: 'eng.league_cup',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/41.png',
    country: 'Angleterre',
  },
  {
    id: 'esp.copa_del_rey',
    slug: 'copa-del-rey',
    name: 'Coupe du Roi',
    sport: 'football',
    espnLeague: 'esp.copa_del_rey',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/80.png',
    country: 'Espagne',
  },
  {
    id: 'ita.coppa_italia',
    slug: 'coppa-italia',
    name: 'Coupe d\'Italie',
    sport: 'football',
    espnLeague: 'ita.coppa_italia',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2192.png',
    country: 'Italie',
  },
  {
    id: 'fra.coupe_de_france',
    slug: 'coupe-de-france',
    name: 'Coupe de France',
    sport: 'football',
    espnLeague: 'fra.coupe_de_france',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/182.png',
    country: 'France',
  },
  {
    id: 'ger.dfb_pokal',
    slug: 'dfb-pokal',
    name: 'DFB-Pokal',
    sport: 'football',
    espnLeague: 'ger.dfb_pokal',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2061.png',
    country: 'Allemagne',
  },
  {
    id: 'ksa.kings.cup',
    slug: 'kings-cup',
    name: 'King\'s Cup',
    sport: 'football',
    espnLeague: 'ksa.kings.cup',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png',
    country: 'Arabie Saoudite',
  },
  {
    id: 'nba',
    slug: 'nba',
    name: 'NBA',
    sport: 'basketball',
    espnLeague: 'nba',
    logo: 'https://a.espncdn.com/i/teamlogos/leagues/500/nba.png',
    country: 'USA',
  },
];

export class MatchesService {
  /**
   * Récupère la liste des compétitions / ligues supportées
   */
  getLeagues(): MatchLeague[] {
    return LEAGUES_CONFIG.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      logo: l.logo,
      country: l.country,
      sport: l.sport,
    }));
  }

  /**
   * Index des rencontres des compétitions configurées, pour habiller les
   * affiches. Le flux global ESPN soccer ne nomme pas la compétition (il
   * renvoie « Football ») : seules les requêtes par ligue portent le nom et le
   * badge officiels, d'où le fan-out sur LEAGUES_CONFIG plutôt qu'un appel
   * unique.
   */
  async getPosterIndex(dateStr?: string): Promise<PosterFixture[]> {
    const yyyymmdd = this.formatDateForESPN(dateStr);
    const cached = POSTER_CACHE.get(yyyymmdd);
    if (cached) return cached;

    const configs = LEAGUES_CONFIG.filter((l) => l.sport === 'football');
    const settled = await Promise.allSettled(
      configs.map((config) => this.fetchLeagueMatches(config, yyyymmdd))
    );

    const byId = new Map<string, PosterFixture>();
    for (const res of settled) {
      if (res.status !== 'fulfilled') continue;
      for (const m of res.value) {
        byId.set(m.id, {
          id: m.id,
          home: m.homeTeam.name,
          away: m.awayTeam.name,
          homeLogo: m.homeTeam.logo,
          awayLogo: m.awayTeam.logo,
          leagueId: m.league.id,
          leagueName: m.league.name,
          leagueSlug: m.league.slug || '',
          leagueLogo: m.league.logo || '',
          status: m.status,
          startTs: Math.floor(m.startTimestamp / 1000),
        });
      }
    }

    const index = Array.from(byId.values());
    // Un index vide sort presque toujours d'un fan-out ESPN qui a échoué : le
    // garder 10 minutes laisserait la vitrine dégarnie après une micro-coupure.
    POSTER_CACHE.set(yyyymmdd, index, index.length ? undefined : { ttl: 30_000 });
    return index;
  }

  /**
   * Convertit une date YYYY-MM-DD en format YYYYMMDD attendu par ESPN
   */
  private formatDateForESPN(dateStr?: string): string {
    if (!dateStr) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return `${yyyy}${mm}${dd}`;
    }
    return dateStr.replace(/[^0-9]/g, '');
  }

  /**
   * Parse un événement ESPN en objet standard SportMatch
   */
  private parseEspnEvent(event: any, leagueConfig?: typeof LEAGUES_CONFIG[0], sport: SportType = 'football'): SportMatch | null {
    try {
      const competition = event.competitions?.[0];
      if (!competition) return null;

      const competitors = competition.competitors || [];
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

      if (!homeComp || !awayComp) return null;

      const homeTeam: MatchTeam = {
        id: String(homeComp.id || homeComp.team?.id),
        name: homeComp.team?.displayName || homeComp.team?.name || 'Équipe 1',
        shortName: homeComp.team?.shortDisplayName || homeComp.team?.name,
        abbreviation: homeComp.team?.abbreviation,
        logo: homeComp.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${homeComp.id}.png`,
        score: homeComp.score !== undefined ? parseInt(homeComp.score, 10) : undefined,
        isWinner: homeComp.winner || false,
      };

      const awayTeam: MatchTeam = {
        id: String(awayComp.id || awayComp.team?.id),
        name: awayComp.team?.displayName || awayComp.team?.name || 'Équipe 2',
        shortName: awayComp.team?.shortDisplayName || awayComp.team?.name,
        abbreviation: awayComp.team?.abbreviation,
        logo: awayComp.team?.logo || `https://a.espncdn.com/i/teamlogos/soccer/500/${awayComp.id}.png`,
        score: awayComp.score !== undefined ? parseInt(awayComp.score, 10) : undefined,
        isWinner: awayComp.winner || false,
      };

      // Statut du match
      const statusType = event.status?.type?.name || '';
      const state = event.status?.type?.state || 'pre';
      let status: MatchStatus = 'upcoming';

      if (state === 'in') {
        status = 'live';
      } else if (state === 'post') {
        status = 'finished';
      } else if (statusType.includes('POSTPONED')) {
        status = 'postponed';
      } else if (statusType.includes('CANCELLED')) {
        status = 'cancelled';
      }

      // Minute / période
      const minute = event.status?.displayClock || (event.status?.clock ? `${Math.floor(event.status.clock / 60)}'` : undefined);
      const statusText = event.status?.type?.shortDetail || event.status?.type?.description;

      // Diffuseurs
      const broadcasts = (competition.broadcasts || [])
        .flatMap((b: any) => b.names || [b.name])
        .filter(Boolean);

      // Venue / Stade
      const venue = competition.venue?.fullName
        ? `${competition.venue.fullName}${competition.venue.address?.city ? ` (${competition.venue.address.city})` : ''}`
        : undefined;

      const leagueName = leagueConfig?.name || event.league?.name || competition.league?.name || 'Football';
      const leagueLogo = leagueConfig?.logo || event.league?.logos?.[0]?.href || 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png';

      const league: MatchLeague = {
        id: leagueConfig?.id || event.league?.id || 'soccer',
        name: leagueName,
        slug: leagueConfig?.slug || 'soccer',
        logo: leagueLogo,
        country: leagueConfig?.country || 'International',
      };

      return {
        id: String(event.id),
        title: `${homeTeam.name} vs ${awayTeam.name}`,
        homeTeam,
        awayTeam,
        status,
        statusText,
        minute: status === 'live' ? minute : undefined,
        period: event.status?.period ? `Période ${event.status.period}` : undefined,
        startTime: event.date || new Date().toISOString(),
        startTimestamp: event.date ? new Date(event.date).getTime() : Date.now(),
        league,
        venue,
        broadcast: broadcasts.length > 0 ? broadcasts : undefined,
        sport,
      };
    } catch (e: any) {
      console.warn('[MatchesService] Erreur parsing event ESPN:', e.message);
      return null;
    }
  }

  /**
   * Récupère les matchs pour une ligue spécifique
   */
  async fetchLeagueMatches(leagueConfig: typeof LEAGUES_CONFIG[0], yyyymmdd: string): Promise<SportMatch[]> {
    try {
      const isBasketball = leagueConfig.sport === 'basketball';
      const endpoint = isBasketball
        ? `https://site.api.espn.com/apis/site/v2/sports/basketball/${leagueConfig.espnLeague}/scoreboard?dates=${yyyymmdd}`
        : `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueConfig.espnLeague}/scoreboard?dates=${yyyymmdd}`;

      const { data } = await axios.get(endpoint, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 7000,
      });

      let events = data?.events && Array.isArray(data.events) ? data.events : [];

      // Si aucun match n'est programmé ce jour précis pour cette ligue, récupérer la journée en cours / prochaine journée
      if (events.length === 0) {
        try {
          const fallbackEndpoint = isBasketball
            ? `https://site.api.espn.com/apis/site/v2/sports/basketball/${leagueConfig.espnLeague}/scoreboard`
            : `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueConfig.espnLeague}/scoreboard`;
          const fbRes = await axios.get(fallbackEndpoint, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 7000,
          });
          if (fbRes.data?.events && Array.isArray(fbRes.data.events) && fbRes.data.events.length > 0) {
            events = fbRes.data.events;
          }
        } catch (_) {}
      }

      const matches: SportMatch[] = [];
      for (const ev of events) {
        const parsed = this.parseEspnEvent(ev, leagueConfig, leagueConfig.sport);
        if (parsed) matches.push(parsed);
      }
      return matches;
    } catch (err: any) {
      console.warn(`[MatchesService] Erreur fetch ESPN ligue ${leagueConfig.id}:`, err.message);
      return [];
    }
  }

  /**
   * Récupère les matchs de secours via LiveBall
   */
  private async fetchLiveBallFallback(): Promise<SportMatch[]> {
    try {
      const { getLiveBallMatches } = await import('../liveball/liveball.service');
      const lbMatches = await getLiveBallMatches();
      if (!lbMatches || lbMatches.length === 0) return [];

      return lbMatches.map((m) => ({
        id: `lb_${m.id}`,
        title: `${m.home} vs ${m.away}`,
        homeTeam: {
          id: `h_${m.home}`,
          name: m.home,
          logo: m.homeLogo,
          score: m.score ? parseInt(m.score.split('-')[0]?.trim(), 10) || undefined : undefined,
        },
        awayTeam: {
          id: `a_${m.away}`,
          name: m.away,
          logo: m.awayLogo,
          score: m.score ? parseInt(m.score.split('-')[1]?.trim(), 10) || undefined : undefined,
        },
        status: m.status === 'live' ? 'live' : 'upcoming',
        minute: m.minute,
        startTime: m.startTs ? new Date(m.startTs * 1000).toISOString() : new Date().toISOString(),
        startTimestamp: m.startTs ? m.startTs * 1000 : Date.now(),
        league: {
          id: 'liveball',
          name: m.league || 'Football Direct',
          slug: 'football',
          country: 'International',
        },
        sport: 'football' as SportType,
      }));
    } catch (e: any) {
      console.warn('[MatchesService] Erreur fallback LiveBall:', e.message);
      return [];
    }
  }

  /**
   * Récupère tous les matchs mondiaux du jour (flux global soccer all).
   *
   * Le flux global n'embarque pas la ligue : on la résout via summary (cache
   * 24h par identifiant numérique) pour que chaque match soit étiqueté, groupé
   * et qualifiable « grande compétition » — sans ça, tout arrive en « Football ».
   */
  async fetchGlobalSoccerMatches(yyyymmdd: string): Promise<SportMatch[]> {
    try {
      const endpoint = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${yyyymmdd}`;
      const { data } = await axios.get(endpoint, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 12000,
      });

      if (!data?.events || !Array.isArray(data.events)) return [];

      const events: any[] = data.events;
      await resolveLeaguesForEvents(events);

      const matches: SportMatch[] = [];
      for (const ev of events) {
        const leagueId = ev.league?.id || '';
        let matchingConfig = LEAGUES_CONFIG.find(
          (l) => l.id === leagueId || ev.league?.name?.toLowerCase()?.includes(l.slug)
        );

        if (!matchingConfig && !ev.league) {
          const num = numericLeagueId(ev);
          const resolved = num ? LEAGUE_BY_NUMERIC_ID.get(num)?.league : undefined;
          if (resolved) {
            matchingConfig = LEAGUES_CONFIG.find(
              (l) =>
                l.id === resolved.slug ||
                l.slug === resolved.slug ||
                l.name.toLowerCase() === (resolved.name || '').toLowerCase()
            );
            if (!matchingConfig) {
              // Ligue non listée dans la config : on étiquette avec son identité
              // réelle plutôt que « Football » (groupement + vitrine corrects).
              matchingConfig = {
                id: resolved.slug,
                slug: resolved.slug,
                name: resolved.name,
                sport: 'football' as SportType,
                espnLeague: resolved.slug,
                logo: resolved.logo || 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
                country: 'International',
              };
            }
          }
        }

        const parsed = this.parseEspnEvent(ev, matchingConfig, 'football');
        if (parsed) matches.push(parsed);
      }
      return matches;
    } catch (err: any) {
      console.warn('[MatchesService] Erreur fetch global soccer ESPN:', err.message);
      return [];
    }
  }

  /**
   * Récupère les matchs selon les filtres (statut, ligue, date, sport, recherche)
   */
  async getMatches(options: MatchesFilterOptions = {}): Promise<SportMatch[]> {
    const yyyymmdd = this.formatDateForESPN(options.date);
    const cacheKey = `${yyyymmdd}_${options.league || 'all'}_${options.sport || 'all'}`;

    let matches: SportMatch[] = [];

    // Vérification du cache LRU
    if (MATCHES_CACHE.has(cacheKey)) {
      matches = MATCHES_CACHE.get(cacheKey)!;
    } else {
      if (options.league && options.league !== 'all') {
        const leagueConfig = LEAGUES_CONFIG.find((l) => l.id === options.league || l.slug === options.league);
        if (leagueConfig) {
          matches = await this.fetchLeagueMatches(leagueConfig, yyyymmdd);
        } else {
          matches = await this.fetchGlobalSoccerMatches(yyyymmdd);
        }
      } else {
        // Tentative 1 : Flux global ESPN Soccer
        const soccerMatches = await this.fetchGlobalSoccerMatches(yyyymmdd);
        matches = [...soccerMatches];

        // Tentative 2 : Si le flux global était vide ou en échec, interroger les ligues majeures en parallèle
        if (matches.length === 0) {
          const leaguePromises = LEAGUES_CONFIG.filter((l) => l.sport === 'football').map((l) =>
            this.fetchLeagueMatches(l, yyyymmdd)
          );
          const settled = await Promise.allSettled(leaguePromises);
          for (const res of settled) {
            if (res.status === 'fulfilled') {
              matches.push(...res.value);
            }
          }
        }

        // Tentative 3 : Fallback LiveBall pour garantir 100% de disponibilité des matchs en direct
        if (matches.length === 0) {
          const lbFallback = await this.fetchLiveBallFallback();
          matches.push(...lbFallback);
        }

        // Ajouter NBA si pertinent
        if (!options.sport || options.sport === 'basketball' || options.sport === 'all') {
          const nbaConfig = LEAGUES_CONFIG.find((l) => l.id === 'nba');
          if (nbaConfig) {
            try {
              const nbaMatches = await this.fetchLeagueMatches(nbaConfig, yyyymmdd);
              matches.push(...nbaMatches);
            } catch (_) {}
          }
        }
      }

      // Tri des matchs : LIVE d'abord, puis par heure de début
      matches.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        return a.startTimestamp - b.startTimestamp;
      });

      MATCHES_CACHE.set(cacheKey, matches);
    }

    // Filtrage dynamique post-cache
    let filtered = [...matches];

    // Filtre par statut (live, upcoming, finished)
    if (options.status && options.status !== 'all') {
      filtered = filtered.filter((m) => m.status === options.status);
    }

    // Filtre par sport (football, basketball)
    if (options.sport && options.sport !== 'all') {
      filtered = filtered.filter((m) => m.sport === options.sport);
    }

    // Filtre par recherche textuelle (équipe ou compétition)
    if (options.search) {
      const q = options.search.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.league.name.toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  /**
   * Récupère un match par son ID unique
   */
  async getMatchById(id: string): Promise<SportMatch | null> {
    const allMatches = await this.getMatches({ status: 'all' });
    const found = allMatches.find((m) => m.id === id);
    if (found) return found;

    // Tentative de fetch direct par ID ESPN
    try {
      const endpoint = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${id}`;
      const { data } = await axios.get(endpoint, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 6000,
      });

      if (data?.header) {
        return this.parseEspnEvent(data.header, undefined, 'football');
      }
    } catch (_) {}

    return null;
  }

  /**
   * Récupère les détails complets (summary) d'un match de football :
   * - boxscore (stats globales : tirs, possession, fautes, cartons, etc.)
   * - rosters (compositions : titulaires et remplaçants avec position, maillot, etc.)
   * - keyEvents (buteurs, cartons, remplacements avec minute et joueurs)
   */
  async getMatchSummary(eventId: string, league?: string): Promise<MatchSummary | null> {
    const cacheKey = `summary_${eventId}_${league || 'all'}`;
    if (SUMMARY_CACHE.has(cacheKey)) {
      return SUMMARY_CACHE.get(cacheKey)!;
    }

    // Résolution du slug / id de ligue ESPN (ex: eng.1, fra.1, esp.1, etc. ou fallback 'all')
    let espnLeague = 'all';
    if (league && league !== 'all') {
      const config = LEAGUES_CONFIG.find(
        (l) => l.id === league || l.slug === league || l.espnLeague === league
      );
      espnLeague = config ? config.espnLeague : league;
    }

    let rawData: any = null;

    // 1ère tentative : interroger l'endpoint summary avec la ligue demandée
    try {
      const endpoint = `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/summary?event=${eventId}`;
      const res = await axios.get(endpoint, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000,
      });
      if (res.data) {
        rawData = res.data;
      }
    } catch (err: any) {
      console.warn(`[MatchesService] Erreur summary ESPN ligue ${espnLeague} (${eventId}):`, err.message);
    }

    // 2ème tentative : fallback sur 'all' si la ligue spécifique n'a pas répondu
    if (!rawData && espnLeague !== 'all') {
      try {
        const fallbackEndpoint = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${eventId}`;
        const res = await axios.get(fallbackEndpoint, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: 8000,
        });
        if (res.data) {
          rawData = res.data;
        }
      } catch (err: any) {
        console.warn(`[MatchesService] Erreur fallback summary ESPN all (${eventId}):`, err.message);
      }
    }

    if (!rawData) {
      return null;
    }

    try {
      // ─── 1. Header & Informations Générales du Match ───
      const header = rawData.header || {};
      const competition = header.competitions?.[0] || {};
      const competitors = competition.competitors || [];
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0] || {};
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1] || {};

      const homeTeam: MatchTeam = {
        id: String(homeComp.id || homeComp.team?.id || 'home'),
        name: homeComp.team?.displayName || homeComp.team?.name || 'Équipe 1',
        shortName: homeComp.team?.shortDisplayName || homeComp.team?.name,
        abbreviation: homeComp.team?.abbreviation,
        logo: homeComp.team?.logo || homeComp.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/soccer/500/${homeComp.id}.png`,
        score: homeComp.score !== undefined ? parseInt(homeComp.score, 10) : undefined,
        isWinner: Boolean(homeComp.winner),
      };

      const awayTeam: MatchTeam = {
        id: String(awayComp.id || awayComp.team?.id || 'away'),
        name: awayComp.team?.displayName || awayComp.team?.name || 'Équipe 2',
        shortName: awayComp.team?.shortDisplayName || awayComp.team?.name,
        abbreviation: awayComp.team?.abbreviation,
        logo: awayComp.team?.logo || awayComp.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/soccer/500/${awayComp.id}.png`,
        score: awayComp.score !== undefined ? parseInt(awayComp.score, 10) : undefined,
        isWinner: Boolean(awayComp.winner),
      };

      const state = competition.status?.type?.state || 'pre';
      let status: MatchStatus = 'upcoming';
      if (state === 'in') status = 'live';
      else if (state === 'post') status = 'finished';
      else if (competition.status?.type?.name?.includes('POSTPONED')) status = 'postponed';
      else if (competition.status?.type?.name?.includes('CANCELLED')) status = 'cancelled';

      const leagueInfo: MatchLeague = {
        id: header.league?.id || espnLeague,
        name: header.league?.name || 'Football',
        slug: header.league?.slug || espnLeague,
        logo: header.league?.logos?.[0]?.href || 'https://a.espncdn.com/i/leaguelogos/soccer/500/2.png',
        country: header.league?.country || 'International',
      };

      const venue = rawData.gameInfo?.venue?.fullName
        ? `${rawData.gameInfo.venue.fullName}${rawData.gameInfo.venue.address?.city ? ` (${rawData.gameInfo.venue.address.city})` : ''}`
        : undefined;

      const referee = rawData.gameInfo?.officials?.[0]?.displayName;

      const broadcasts = (rawData.broadcasts || [])
        .flatMap((b: any) => b.names || [b.name])
        .filter(Boolean);

      // ─── 2. Data Mapping : Boxscore (Statistiques Globales) ───
      const boxscoreTeams = rawData.boxscore?.teams || [];
      const boxscore: TeamBoxscore[] = boxscoreTeams.map((t: any) => ({
        team: {
          id: String(t.team?.id || ''),
          name: t.team?.displayName || t.team?.name || '',
          abbreviation: t.team?.abbreviation,
          logo: t.team?.logo || t.team?.logos?.[0]?.href,
        },
        statistics: (t.statistics || []).map((s: any) => ({
          name: s.name,
          label: s.label || s.displayName || s.name,
          displayValue: String(s.displayValue ?? s.value ?? ''),
        })),
      }));

      // ─── 3. Data Mapping : Rosters (Compositions : Titulaires & Remplaçants) ───
      const rostersData = rawData.rosters || [];
      const rosters: TeamRoster[] = rostersData.map((r: any) => {
        const allPlayers = r.roster || [];

        const mapPlayer = (p: any, isStarter: boolean): MatchPlayer => ({
          id: String(p.athlete?.id || ''),
          name: p.athlete?.displayName || p.athlete?.fullName || 'Joueur',
          shortName: p.athlete?.shortName,
          jersey: p.jersey || p.athlete?.jersey,
          position: p.position?.abbreviation || p.position?.displayName,
          formationPlace: p.formationPlace,
          starter: isStarter,
          subbedIn: Boolean(p.subbedIn),
          subbedOut: Boolean(p.subbedOut),
          photo: p.athlete?.headshot?.href,
        });

        const starters = allPlayers.filter((p: any) => p.starter === true).map((p: any) => mapPlayer(p, true));
        const bench = allPlayers.filter((p: any) => p.starter === false).map((p: any) => mapPlayer(p, false));

        return {
          team: {
            id: String(r.team?.id || ''),
            name: r.team?.displayName || r.team?.name || '',
            abbreviation: r.team?.abbreviation,
            logo: r.team?.logo || r.team?.logos?.[0]?.href,
          },
          formation: r.formation,
          starters,
          bench,
        };
      });

      // ─── 4. Data Mapping : KeyEvents (Buteurs, Cartons, Remplacements) ───
      const rawEvents = rawData.keyEvents || [];
      const keyEvents: MatchKeyEvent[] = rawEvents.map((ev: any) => ({
        id: String(ev.id || ''),
        type: ev.type?.text || ev.type?.type || 'Event',
        clock: ev.clock?.displayValue || (ev.clock?.value ? `${Math.floor(ev.clock.value / 60)}'` : undefined),
        period: ev.period?.number,
        text: ev.text || ev.shortText || '',
        shortText: ev.shortText,
        scoringPlay: Boolean(ev.scoringPlay),
        teamId: ev.team?.id ? String(ev.team.id) : undefined,
        teamName: ev.team?.displayName || ev.team?.name,
        participants: (ev.participants || []).map((part: any) => ({
          id: String(part.athlete?.id || ''),
          name: part.athlete?.displayName || part.athlete?.name || '',
        })),
      }));

      const summary: MatchSummary = {
        id: String(header.id || eventId),
        title: `${homeTeam.name} vs ${awayTeam.name}`,
        status,
        statusText: competition.status?.type?.shortDetail || competition.status?.type?.description,
        minute: status === 'live' ? competition.status?.displayClock : undefined,
        startTime: competition.date || header.date || new Date().toISOString(),
        league: leagueInfo,
        venue,
        referee,
        homeTeam,
        awayTeam,
        boxscore,
        rosters,
        keyEvents,
        broadcasts: broadcasts.length > 0 ? broadcasts : undefined,
      };

      SUMMARY_CACHE.set(cacheKey, summary);
      return summary;
    } catch (parseError: any) {
      console.error(`[MatchesService] Erreur mapping summary ESPN (${eventId}):`, parseError);
      return null;
    }
  }

  /**
   * Résout automatiquement le flux vidéo en direct d'un match (Option A : LiveBall, Kora, Streamiz...)
   * Fait correspondre le match ESPN avec les agrégateurs de flux vidéo.
   */
  async getMatchStream(id: string): Promise<any | null> {
    const cacheKey = `match_stream_${id}`;
    const cached = STREAM_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < 30_000) {
      return cached.data;
    }

    try {
      const match = await this.getMatchById(id);
      if (!match) return null;

      const sportsMatches = await getSportsMatches();
      const matched = sportsMatches.find((sm) =>
        areTeamsMatching(match.homeTeam.name, match.awayTeam.name, sm.home, sm.away)
      );

      if (!matched) return null;

      const flux = await resolveSportsFlux(matched);
      if (!flux) return null;

      // Relay HLS same-origin : le player consomme notre backend (referer et IP
      // côté serveur), pas le CDN distant. Disponible pour toutes les sources.
      const relayUrl =
        flux.stream.type === 'hls'
          ? `/api/sports/match/${flux.source}/${encodeURIComponent(flux.sourceId)}/hls/playlist.m3u8`
          : undefined;

      const result = {
        matchId: id,
        source: flux.source,
        sourceId: flux.sourceId,
        url: relayUrl ?? flux.stream.url,
        directUrl: flux.stream.url,
        type: flux.stream.type,
        relayUrl,
        servers: flux.stream.servers.map((s) => ({
          name: flux.source.toUpperCase(),
          url: s.url,
          type: (s.type || flux.stream.type) as 'hls' | 'iframe',
          relayUrl,
        })),
      };

      STREAM_CACHE.set(cacheKey, { ts: Date.now(), data: result });
      return result;
    } catch (err) {
      console.warn(`[MatchesService] Erreur résolution flux match ${id}:`, err);
      return null;
    }
  }
}

const STREAM_CACHE = new Map<string, { ts: number; data: any }>();

function normalizeTeam(name?: string): string {
  if (!name) return '';
  let s = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\bparis\s+saint[- ]germain\b/g, 'psg');
  s = s.replace(/\bmanchester\s+city\b/g, 'mancity');
  s = s.replace(/\bmanchester\s+united\b/g, 'manunited');
  s = s.replace(/\bman\s+utd\b/g, 'manunited');
  s = s.replace(/\bman\s+city\b/g, 'mancity');
  s = s.replace(/\batletico\s+madrid\b/g, 'atleticomadrid');
  s = s.replace(/\breal\s+madrid\b/g, 'realmadrid');
  s = s.replace(/\bbayern\s+munich\b/g, 'bayernmunich');
  s = s.replace(/\bbayern\s+münchen\b/g, 'bayernmunich');
  s = s.replace(/\bborussia\s+dortmund\b/g, 'dortmund');
  s = s.replace(/\bbvb\b/g, 'dortmund');
  s = s.replace(/\bspurs\b/g, 'tottenham');
  s = s.replace(/\bwolves\b/g, 'wolverhampton');
  s = s.replace(/\bbarca\b/g, 'barcelona');
  s = s.replace(/\binter\s+milan\b/g, 'inter');
  s = s.replace(/\bac\s+milan\b/g, 'milan');
  s = s.replace(/\bolympique\s+de\s+marseille\b/g, 'marseille');
  s = s.replace(/\bolympique\s+lyonnais\b/g, 'lyon');
  s = s.replace(/\b(fc|cf|sc|ac|as|rc|us|afc|ssc|cd|club|de|united|city|hotspur|sporting)\b/g, '');
  s = s.replace(/[^a-z0-9]/g, '');
  return s.trim();
}

function areTeamsMatching(h1?: string, a1?: string, h2?: string, a2?: string): boolean {
  const normH1 = normalizeTeam(h1);
  const normA1 = normalizeTeam(a1);
  const normH2 = normalizeTeam(h2);
  const normA2 = normalizeTeam(a2);
  if (!normH1 || !normH2) return false;

  const directMatch =
    (normH1.includes(normH2) || normH2.includes(normH1)) &&
    (!normA1 || !normA2 || normA1.includes(normA2) || normA2.includes(normA1));

  const invertedMatch =
    (normH1.includes(normA2) || normA2.includes(normH1)) &&
    (!normA1 || !normH2 || normA1.includes(normH2) || normH2.includes(normA1));

  return directMatch || invertedMatch;
}

export const matchesService = new MatchesService();
