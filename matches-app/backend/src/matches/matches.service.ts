import { LRUCache } from 'lru-cache';
import { EspnClient } from '../espn/espn.client';
import {
  COUNTRIES_CONFIG,
  LEAGUES_CONFIG,
  getCountriesConfig,
  getLeaguesConfig,
  getLeaguesByCountryConfig,
  getLeagueByIdConfig,
  LeagueConfig,
} from '../config/leagues.config';
import {
  SportMatch,
  MatchStatus,
  MatchLeague,
  MatchTeam,
  MatchesFilterOptions,
  SportType,
  MatchSummary,
  TeamBoxscore,
  TeamRoster,
  MatchKeyEvent,
  MatchPlayer,
  CountryInfo,
} from './matches.types';
import { LiveScoreService } from './livescore.service';

export { COUNTRIES_CONFIG, LEAGUES_CONFIG, LeagueConfig };

const MATCHES_CACHE = new LRUCache<string, SportMatch[]>({
  max: 200,
  ttl: 30_000, // 30s de cache
});

const SUMMARY_CACHE = new LRUCache<string, MatchSummary>({
  max: 100,
  ttl: 15_000,
});

export class MatchesService {
  /**
   * Construit la chaîne de query (dates, month, season, seasontype, limit)
   */
  private buildScoreboardQuery(options: MatchesFilterOptions): string {
    const params = new URLSearchParams();

    if (options.month) {
      // YYYY-MM ou YYYYMM -> tout le mois complet
      const cleanMonth = String(options.month).replace(/[-/]/g, '').slice(0, 6);
      params.set('dates', cleanMonth);
    } else if (options.date) {
      // YYYY-MM-DD ou YYYYMMDD -> un jour précis
      const cleanDate = String(options.date).replace(/[-/]/g, '').slice(0, 8);
      params.set('dates', cleanDate);
    } else if (options.season) {
      // Année de saison spécifique
      params.set('season', String(options.season));
      if (options.seasontype) {
        params.set('seasontype', String(options.seasontype));
      }
    } else {
      // Par défaut : aujourd'hui
      const now = new Date();
      const today = now.toISOString().split('T')[0].replace(/-/g, '');
      params.set('dates', today);
    }

    if (options.limit && options.limit > 0) {
      params.set('limit', String(options.limit));
    } else {
      // ESPN plafonne le scoreboard global à 100 events sans "limit" explicite
      params.set('limit', '500');
    }

    return params.toString();
  }

  getCountries(): CountryInfo[] {
    return getCountriesConfig();
  }

  getLeagues(): LeagueConfig[] {
    return getLeaguesConfig();
  }

  getLeaguesByCountry(countryId: string): LeagueConfig[] {
    return getLeaguesByCountryConfig(countryId);
  }

  getLeagueById(idOrSlug: string): LeagueConfig | undefined {
    return getLeagueByIdConfig(idOrSlug);
  }

  private parseEspnEvent(
    event: any,
    leagueConfig?: LeagueConfig,
    defaultSport: SportType = 'football'
  ): SportMatch | null {
    try {
      const competition = event.competitions?.[0];
      if (!competition) return null;

      const competitors = competition.competitors || [];
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

      if (!homeComp || !awayComp) return null;

      // Extraire linescores (MT / mi-temps)
      const homeLinescores = Array.isArray(homeComp.linescores) ? homeComp.linescores : [];
      const awayLinescores = Array.isArray(awayComp.linescores) ? awayComp.linescores : [];
      const homeHT = homeLinescores[0]?.value !== undefined ? parseInt(homeLinescores[0].value, 10) : undefined;
      const awayHT = awayLinescores[0]?.value !== undefined ? parseInt(awayLinescores[0].value, 10) : undefined;

      const homeTeam: MatchTeam = {
        id: String(homeComp.id || homeComp.team?.id || 'home'),
        name: homeComp.team?.displayName || homeComp.team?.name || 'Équipe 1',
        shortName: homeComp.team?.shortDisplayName || homeComp.team?.name,
        abbreviation: homeComp.team?.abbreviation,
        logo: homeComp.team?.logo || homeComp.team?.logos?.[0]?.href,
        score: homeComp.score !== undefined ? parseInt(homeComp.score, 10) : undefined,
        halfTimeScore: homeHT,
        penaltyScore: homeComp.shootoutScore !== undefined ? parseInt(homeComp.shootoutScore, 10) : undefined,
        isWinner: Boolean(homeComp.winner),
      };

      const awayTeam: MatchTeam = {
        id: String(awayComp.id || awayComp.team?.id || 'away'),
        name: awayComp.team?.displayName || awayComp.team?.name || 'Équipe 2',
        shortName: awayComp.team?.shortDisplayName || awayComp.team?.name,
        abbreviation: awayComp.team?.abbreviation,
        logo: awayComp.team?.logo || awayComp.team?.logos?.[0]?.href,
        score: awayComp.score !== undefined ? parseInt(awayComp.score, 10) : undefined,
        halfTimeScore: awayHT,
        penaltyScore: awayComp.shootoutScore !== undefined ? parseInt(awayComp.shootoutScore, 10) : undefined,
        isWinner: Boolean(awayComp.winner),
      };

      const state = event.status?.type?.state || competition.status?.type?.state || 'pre';
      let status: MatchStatus = 'upcoming';
      if (state === 'in') status = 'live';
      else if (state === 'post') status = 'finished';
      else if (event.status?.type?.name?.includes('POSTPONED')) status = 'postponed';
      else if (event.status?.type?.name?.includes('CANCELLED')) status = 'cancelled';

      const typeName = (event.status?.type?.name || competition.status?.type?.name || '').toUpperCase();
      const shortDetail = event.status?.type?.shortDetail || competition.status?.type?.shortDetail || '';
      const rawClock = event.status?.clock ?? competition.status?.clock;
      const periodNum = event.status?.period ?? competition.status?.period;

      let minute = event.status?.displayClock || competition.status?.displayClock;

      const isHalftime = typeName.includes('HALFTIME') || shortDetail.toUpperCase() === 'HT' || shortDetail.toLowerCase().includes('half');
      const isFulltime = typeName.includes('FULL_TIME') || shortDetail.toUpperCase() === 'FT' || state === 'post';
      const isOvertime = typeName.includes('OVERTIME') || shortDetail.toUpperCase().includes('ET') || shortDetail.toUpperCase().includes('AET');
      const isShootout = typeName.includes('SHOOTOUT') || shortDetail.toUpperCase().includes('PEN') || shortDetail.toUpperCase().includes('PK');

      let statusShort: string | undefined = undefined;
      if (isHalftime) {
        statusShort = 'MT';
        minute = 'MT';
      } else if (isFulltime) {
        statusShort = 'FT';
      } else if (isOvertime) {
        statusShort = 'ET';
      } else if (isShootout) {
        statusShort = 'TAB';
      } else if (state === 'in') {
        if (!minute) {
          if (shortDetail && (shortDetail.includes('\'') || shortDetail.includes('+'))) {
            minute = shortDetail;
          } else if (rawClock !== undefined && !isNaN(Number(rawClock))) {
            const mins = Math.ceil(Number(rawClock) / 60);
            minute = `${mins}'`;
          }
        }
        if (minute && /^\d+$/.test(minute)) {
          minute = `${minute}'`;
        }
        statusShort = minute || 'LIVE';
      }

      const statusText =
        event.status?.type?.shortDetail ||
        event.status?.type?.description ||
        competition.status?.type?.shortDetail;

      const venue = competition.venue?.fullName
        ? `${competition.venue.fullName}${competition.venue.address?.city ? ` (${competition.venue.address.city})` : ''}`
        : undefined;

      const broadcasts = (competition.broadcasts || [])
        .flatMap((b: any) => b.names || [b.name])
        .filter(Boolean);

      const sport = leagueConfig?.sport || defaultSport;
      const eventLeague = event.league || competition.league || {};

      const league: MatchLeague = {
        id: leagueConfig?.id || eventLeague.id || 'all',
        name: leagueConfig?.name || eventLeague.name || 'Football',
        slug: leagueConfig?.slug || eventLeague.slug || 'football',
        espnLeague: leagueConfig?.espnLeague || eventLeague.slug,
        logo: leagueConfig?.logo || eventLeague.logos?.[0]?.href,
        country: leagueConfig?.country || 'International',
        countryId: leagueConfig?.countryId,
        countryCode: leagueConfig?.countryCode,
        flag: leagueConfig?.flag,
        seasonYear: event.season?.year,
        seasonSlug: event.season?.slug,
      };

      const espnGroup = competition.group?.name || competition.group?.abbreviation;

      return {
        id: String(event.id),
        title: `${homeTeam.name} vs ${awayTeam.name}`,
        homeTeam,
        awayTeam,
        status,
        statusText,
        statusShort,
        minute: status === 'live' ? minute : undefined,
        period: periodNum ? `Période ${periodNum}` : undefined,
        periodNum: periodNum !== undefined ? Number(periodNum) : undefined,
        rawClock: rawClock !== undefined ? Number(rawClock) : undefined,
        clockUpdatedAt: status === 'live' ? Date.now() : undefined,
        startTime: event.date || new Date().toISOString(),
        startTimestamp: event.date ? new Date(event.date).getTime() : Date.now(),
        league,
        group: espnGroup || undefined,
        stage: event.season?.slug || undefined,
        venue,
        broadcast: broadcasts.length > 0 ? broadcasts : undefined,
        sport,
      };
    } catch (e: any) {
      console.warn('[MatchesService] Erreur parsing event ESPN:', e.message);
      return null;
    }
  }

  async fetchLeagueMatches(
    leagueConfig: LeagueConfig,
    options: MatchesFilterOptions
  ): Promise<SportMatch[]> {
    try {
      const queryString = this.buildScoreboardQuery(options);
      const isBasketball = leagueConfig.sport === 'basketball';
      const endpoint = isBasketball
        ? `/apis/site/v2/sports/basketball/${leagueConfig.espnLeague}/scoreboard?${queryString}`
        : `/apis/site/v2/sports/soccer/${leagueConfig.espnLeague}/scoreboard?${queryString}`;

      const data = await EspnClient.fetchJson<any>(endpoint, { cache: !options.bypassCache });
      let events = data?.events && Array.isArray(data.events) ? data.events : [];

      // Fallback si 0 événements et qu'aucun mois/saison n'était forcé
      if (events.length === 0 && !options.month && !options.season && !options.date) {
        const fallbackEndpoint = isBasketball
          ? `/apis/site/v2/sports/basketball/${leagueConfig.espnLeague}/scoreboard`
          : `/apis/site/v2/sports/soccer/${leagueConfig.espnLeague}/scoreboard`;
        const fbData = await EspnClient.fetchJson<any>(fallbackEndpoint, { cache: !options.bypassCache });
        if (fbData?.events && Array.isArray(fbData.events) && fbData.events.length > 0) {
          events = fbData.events;
        }
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

  async fetchGlobalSoccerMatches(options: MatchesFilterOptions): Promise<SportMatch[]> {
    try {
      const queryString = this.buildScoreboardQuery(options);
      const endpoint = `/apis/site/v2/sports/soccer/all/scoreboard?${queryString}`;
      const data = await EspnClient.fetchJson<any>(endpoint, { cache: !options.bypassCache });

      if (!data?.events || !Array.isArray(data.events)) return [];

      const matches: SportMatch[] = [];
      for (const ev of data.events) {
        const leagueConfig =
          getLeagueByIdConfig(String(ev.league?.id || '')) ||
          getLeagueByIdConfig(this.extractLeagueSlug(ev) || '');
        const parsed = this.parseEspnEvent(ev, leagueConfig, 'football');
        if (parsed) matches.push(parsed);
      }
      return matches;
    } catch (err: any) {
      console.warn('[MatchesService] Erreur fetch global soccer ESPN:', err.message);
      return [];
    }
  }

  async getMatches(options: MatchesFilterOptions = {}): Promise<SportMatch[]> {
    const queryKey = this.buildScoreboardQuery(options);
    const countryKey = options.country || 'all';
    const leagueKey = options.league || 'all';
    const sportKey = options.sport || 'all';
    const cacheKey = `${queryKey}_${countryKey}_${leagueKey}_${sportKey}`;

    let matches: SportMatch[] = [];

    if (!options.bypassCache && MATCHES_CACHE.has(cacheKey)) {
      matches = MATCHES_CACHE.get(cacheKey)!;
    } else {
      // 1. Filtrage par PAYS demandé (ex: 'france', 'england', 'spain')
      if (options.country && options.country !== 'all') {
        const countryLeagues = this.getLeaguesByCountry(options.country);
        if (countryLeagues.length > 0) {
          const promises = countryLeagues.map((l) => this.fetchLeagueMatches(l, options));
          const settled = await Promise.allSettled(promises);
          for (const res of settled) {
            if (res.status === 'fulfilled') {
              matches.push(...res.value);
            }
          }
        }
      }
      // 2. Filtrage par LIGUE spécifique demandé (ex: 'eng.1', 'fra.1')
      else if (options.league && options.league !== 'all') {
        const leagueConfig = this.getLeagueById(options.league);
        if (leagueConfig) {
          matches = await this.fetchLeagueMatches(leagueConfig, options);
        } else {
          matches = await this.fetchGlobalSoccerMatches(options);
        }
      }
      // 3. Pas de ligue ni pays spécifique : vue globale
      else {
        const soccerMatches = await this.fetchGlobalSoccerMatches(options);
        matches = [...soccerMatches];

        // Si la vue globale est vide, on requêtes en parallèle les grandes ligues
        if (matches.length === 0) {
          const topLeagues = LEAGUES_CONFIG.filter((l) =>
            ['eng.1', 'esp.1', 'fra.1', 'ita.1', 'ger.1', 'uefa.champions'].includes(l.id)
          );
          const settled = await Promise.allSettled(topLeagues.map((l) => this.fetchLeagueMatches(l, options)));
          for (const res of settled) {
            if (res.status === 'fulfilled') {
              matches.push(...res.value);
            }
          }
        }

        // Si basketball demandé ou all
        if (!options.sport || options.sport === 'basketball' || options.sport === 'all') {
          const nbaConfig = LEAGUES_CONFIG.find((l) => l.id === 'nba');
          if (nbaConfig) {
            try {
              const nbaMatches = await this.fetchLeagueMatches(nbaConfig, options);
              matches.push(...nbaMatches);
            } catch (_) {}
          }
        }
      }

      // Enrichissement automatique des Poules / Groupes via LiveScore date feed
      try {
        const dateKey = options.date ? options.date.replace(/[^0-9]/g, '').slice(0, 8) : undefined;
        const feed = await LiveScoreService.getDateFeed(dateKey);
        if (feed && feed.stages) {
          const cleanStr = (s?: string) => (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\bst[.\s]+/g, 'saint')
            .replace(/\bu[-_\s]?21\b/g, 'u21')
            .replace(/[^a-z0-9]/g, '');

          const concacafTeams = [
            'costarica', 'haiti', 'trinidad', 'curacao', 'nicaragua', 'dominican',
            'puertorico', 'cayman', 'guyana', 'dominica', 'aruba', 'anguilla',
            'bahamas', 'virgin', 'jamaica', 'honduras', 'panama', 'guatemala',
            'elsalvador', 'suriname', 'martinique', 'barbados', 'belize', 'bermuda',
            'grenada', 'saintkitts', 'saintlucia', 'saintvincent', 'cuba', 'guadeloupe'
          ];

          for (const m of matches) {
            if (m.sport === 'football') {
              const hNorm = cleanStr(m.homeTeam.name);
              const aNorm = cleanStr(m.awayTeam.name);

              for (const stage of feed.stages) {
                let matched = false;
                for (const ev of stage.Events || []) {
                  const t1 = cleanStr(ev.T1?.[0]?.Nm);
                  const t2 = cleanStr(ev.T2?.[0]?.Nm);
                  const hMatch = t1.includes(hNorm) || hNorm.includes(t1) || (hNorm.length > 4 && t1.slice(0, 5) === hNorm.slice(0, 5));
                  const aMatch = t2.includes(aNorm) || aNorm.includes(t2) || (aNorm.length > 4 && t2.slice(0, 5) === aNorm.slice(0, 5));
                  if (hMatch && aMatch) {
                    matched = true;
                    const cnm = stage.Cnm || '';
                    const snm = stage.Snm || '';

                    // 1. LaLiga 2 (Deuxième division espagnole)
                    if (snm === 'LaLiga 2' || stage.Ccd === 'spain' || snm.toLowerCase().includes('laliga 2')) {
                      m.league.name = 'LaLiga 2';
                      m.league.country = 'Espagne';
                      m.league.countryCode = 'ES';
                      m.league.flag = '🇪🇸';
                      m.league.id = 'esp.2';
                      m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/16.png';
                      m.group = undefined;
                    }
                    // 2. CONCACAF Nations League
                    else if (cnm.toLowerCase().includes('concacaf')) {
                      m.league.name = 'CONCACAF Nations League';
                      m.league.country = 'Amérique du Nord & Centrale';
                      m.league.countryCode = 'CONCACAF';
                      m.league.flag = '🌎';
                      m.league.id = 'concacaf.nations';
                      m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/12.png';
                      m.group = snm;
                    }
                    // 3. UEFA Nations League
                    else if (cnm.toLowerCase().includes('uefa nations')) {
                      m.league.name = 'UEFA Nations League';
                      m.league.country = 'Europe';
                      m.league.countryCode = 'EU';
                      m.league.flag = '🇪🇺';
                      m.league.id = 'uefa.nations';
                      m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/53.png';
                      m.group = snm;
                    }
                    // 4. Euro U21
                    else if (cnm.toLowerCase().includes('euro u21') || snm.toLowerCase().includes('u21')) {
                      if (cnm.toLowerCase().includes('friendly') || snm.toLowerCase().includes('friendl')) {
                        m.league.name = 'Matchs Amicaux U21';
                        m.league.country = 'International';
                        m.league.flag = '🤝';
                        m.league.id = 'friendly.u21';
                        m.group = undefined;
                      } else {
                        m.league.name = 'Euro U21 2027';
                        m.league.country = 'Europe';
                        m.league.countryCode = 'EU';
                        m.league.flag = '🇪🇺';
                        m.league.id = 'uefa.euro.u21';
                        m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/53.png';
                        m.group = snm;
                      }
                    }
                    // 5. Matchs Amicaux Internationaux
                    else if (cnm.toLowerCase().includes('friendly') || cnm.toLowerCase().includes('amical')) {
                      m.league.name = 'Matchs Amicaux Internationaux';
                      m.league.country = 'International';
                      m.league.flag = '🤝';
                      m.league.id = 'intl.friendly';
                      m.group = undefined;
                    }
                    // 6. Argentine (Primera División, Primera B, Primera Nacional)
                    else if (cnm.toLowerCase().includes('argentina')) {
                      m.league.country = 'Argentine';
                      m.league.countryCode = 'AR';
                      m.league.flag = '🇦🇷';
                      m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/1.png';
                      m.league.name = snm || 'Liga Profesional';
                      m.league.id = snm.toLowerCase().includes('nacional') ? 'arg.2' : snm.toLowerCase().includes('metropolitana') ? 'arg.3' : 'arg.1';
                      m.group = undefined;
                    }
                    // 7. Paraguay, Uruguay, Colombie
                    else if (['paraguay', 'colombia', 'uruguay'].includes(stage.Ccd?.toLowerCase() || '')) {
                      const flagMap: Record<string, string> = { paraguay: '🇵🇾', colombia: '🇨🇴', uruguay: '🇺🇾' };
                      const nameMap: Record<string, string> = { paraguay: 'Paraguay', colombia: 'Colombie', uruguay: 'Uruguay' };
                      const ccd = (stage.Ccd || '').toLowerCase();
                      m.league.country = nameMap[ccd] || cnm;
                      m.league.flag = flagMap[ccd] || '🌎';
                      m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/1543.png';
                      m.league.name = snm || m.league.name;
                      m.group = undefined;
                    }
                    // 8. Championnats réguliers
                    else {
                      if (snm) m.league.name = snm;
                      if (cnm) m.league.country = cnm;
                      m.group = undefined;
                    }
                    break;
                  }
                }
                if (matched) break;
              }

              // Fallback si non trouvé dans LiveScore mais équipe clairement CONCACAF
              if (
                m.league.name === 'Football' &&
                (concacafTeams.some((t) => hNorm.includes(t)) || concacafTeams.some((t) => aNorm.includes(t)))
              ) {
                m.league.name = 'CONCACAF Nations League';
                m.league.country = 'Amérique du Nord & Centrale';
                m.league.countryCode = 'CONCACAF';
                m.league.flag = '🌎';
                m.league.id = 'concacaf.nations';
                m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/12.png';
              }

              // Fallback pour les matchs amicaux détectés par seasonSlug
              const seasonSlug = (m.league.seasonSlug || '').toLowerCase();
              if (seasonSlug.includes('u21-international-friendly') || seasonSlug.includes('u21-friendly')) {
                m.league.name = 'Matchs Amicaux U21';
                m.league.country = 'International';
                m.league.flag = '🤝';
                m.league.id = 'friendly.u21';
              } else if (seasonSlug.includes('international-friendly') || m.league.name === 'Friendlies') {
                m.league.name = 'Matchs Amicaux Internationaux';
                m.league.country = 'International';
                m.league.flag = '🤝';
                m.league.id = 'intl.friendly';
              } else if (m.league.name === 'Football' && seasonSlug.includes('clausura')) {
                // Équipes sud-américaines
                if (hNorm.includes('banfield') || aNorm.includes('rosariocentral') || hNorm.includes('boca') || hNorm.includes('river')) {
                  m.league.name = 'Liga Profesional: Clausura';
                  m.league.country = 'Argentine';
                  m.league.flag = '🇦🇷';
                  m.league.id = 'arg.1';
                  m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/1.png';
                } else if (hNorm.includes('medellin') || aNorm.includes('santafe') || hNorm.includes('millonarios') || hNorm.includes('nacional')) {
                  m.league.name = 'Primera A: Clausura';
                  m.league.country = 'Colombie';
                  m.league.flag = '🇨🇴';
                  m.league.id = 'col.1';
                  m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/1543.png';
                } else if (hNorm.includes('libertad') || aNorm.includes('recoleta') || hNorm.includes('cerroporteno') || hNorm.includes('olimpia')) {
                  m.league.name = 'Division Profesional: Clausura';
                  m.league.country = 'Paraguay';
                  m.league.flag = '🇵🇾';
                  m.league.id = 'par.1';
                  m.league.logo = 'https://a.espncdn.com/i/leaguelogos/soccer/500/1543.png';
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[MatchesService] Enrichissement LiveScore stage ignoré:', err.message);
      }

      // Tri intelligent : En direct en premier, puis ordre chronologique
      matches.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (b.status === 'live' && a.status !== 'live') return 1;
        return a.startTimestamp - b.startTimestamp;
      });

      if (matches.length > 0) {
        MATCHES_CACHE.set(cacheKey, matches);
      }
    }

    let filtered = [...matches];

    // Filtre strict par date demandée (ex: 2026-10-04) : uniquement les matchs de ce jour précis
    if (options.date && !options.month && !options.season) {
      const targetDate = options.date.includes('-')
        ? options.date
        : `${options.date.slice(0, 4)}-${options.date.slice(4, 6)}-${options.date.slice(6, 8)}`;
      
      // On garde les matchs dont le jour UTC est le jour demandé ±1 :
      // une journée ESPN couvre aussi les matchs du lendemain UTC
      // (soirée du jour précédent pour les fuseaux Amériques).
      const DAY_MS = 86_400_000;
      const targetMs = Date.parse(`${targetDate}T00:00:00Z`);

      filtered = filtered.filter((m) => {
        if (!m.startTime) return false;
        const ts = Date.parse(m.startTime);
        if (Number.isNaN(ts)) return false;
        const utcDay = ts - (ts % DAY_MS);
        return Math.abs(utcDay - targetMs) <= DAY_MS;
      });
    }

    // Filtre statut
    if (options.status && options.status !== 'all') {
      filtered = filtered.filter((m) => m.status === options.status);
    }

    // Filtre sport
    if (options.sport && options.sport !== 'all') {
      filtered = filtered.filter((m) => m.sport === options.sport);
    }

    // Recherche par mot clé (nom d'équipe ou ligue)
    if (options.search) {
      const q = options.search.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.homeTeam.name.toLowerCase().includes(q) ||
          m.awayTeam.name.toLowerCase().includes(q) ||
          m.league.name.toLowerCase().includes(q)
      );
    }

    // Limite de résultats si précisée
    if (options.limit && options.limit > 0 && filtered.length > options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Extrait le slug de ligue depuis les links ESPN ("/league/<slug>"),
   * utile car event.league est null sur le scoreboard global "soccer/all".
   */
  private extractLeagueSlug(event: any): string | undefined {
    if (event?.league?.slug) return String(event.league.slug);

    for (const link of event?.links || []) {
      const href = String(link?.href || '');
      const marker = '/league/';
      const idx = href.indexOf(marker);
      if (idx !== -1) {
        const slug = href.slice(idx + marker.length).split(/[/?#]/)[0];
        if (slug) return slug;
      }
    }

    return undefined;
  }

  /**
   * Résout le couple (sport, ligue ESPN) à partir du paramètre "league".
   * Si la ligue est inconnue, on retombe sur "all" plutôt que d'envoyer
   * une valeur brute (ex: "football") qui provoque un appel ESPN mort.
   */
  private resolveEspnTarget(league?: string): { pathSport: 'soccer' | 'basketball'; espnLeague: string } {
    let pathSport: 'soccer' | 'basketball' = 'soccer';
    let espnLeague = 'all';

    if (league && league !== 'all') {
      const config = this.getLeagueById(league);
      if (config) {
        espnLeague = config.espnLeague || 'all';
        pathSport = config.sport === 'basketball' ? 'basketball' : 'soccer';
      } else if (/^[a-z0-9]+(?:[._-][a-z0-9]+)+$/.test(league)) {
        espnLeague = league;
      }
    }

    return { pathSport, espnLeague };
  }

  /**
   * Récupère le JSON brut du summary, sport-agnostique, avec fallbacks successifs.
   */
  private async fetchSummaryRaw(
    eventId: string,
    league?: string
  ): Promise<{ raw: any; pathSport: 'soccer' | 'basketball' } | null> {
    const { pathSport, espnLeague } = this.resolveEspnTarget(league);

    const candidates: string[] = [
      `/apis/site/v2/sports/${pathSport}/${espnLeague}/summary?event=${eventId}`,
    ];
    if (pathSport === 'soccer') {
      if (espnLeague !== 'all') {
        candidates.push(`/apis/site/v2/sports/soccer/all/summary?event=${eventId}`);
      }
      candidates.push(`/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`);
    }

    for (const endpoint of candidates) {
      try {
        const raw = await EspnClient.fetchJson<any>(endpoint);
        if (raw?.header) {
          return { raw, pathSport: endpoint.includes('/sports/basketball/') ? 'basketball' : pathSport };
        }
      } catch (err: any) {
        console.warn(`[MatchesService] Erreur summary ESPN (${endpoint}):`, err.message);
      }
    }

    return null;
  }

  async getMatchById(id: string): Promise<SportMatch | null> {
    const allMatches = await this.getMatches({ status: 'all' });
    const found = allMatches.find((m) => m.id === id);
    if (found) return found;

    // Match d'un autre jour ou d'un sport non couvert par la liste du jour
    const fetched = await this.fetchSummaryRaw(id);
    if (!fetched) return null;

    try {
      const header = fetched.raw.header || {};
      const leagueSlug = this.extractLeagueSlug(header) || header.league?.slug;
      const leagueConfig = leagueSlug
        ? getLeagueByIdConfig(String(leagueSlug)) || getLeagueByIdConfig(String(header.league?.id || ''))
        : undefined;
      const defaultSport = fetched.pathSport === 'basketball' ? 'basketball' : 'football';
      return this.parseEspnEvent(header, leagueConfig, defaultSport);
    } catch (err: any) {
      console.warn(`[MatchesService] Erreur mapping match ${id} depuis summary:`, err.message);
      return null;
    }
  }

  async getMatchSummary(eventId: string, league?: string): Promise<MatchSummary | null> {
    const cacheKey = `summary_${eventId}_${league || 'all'}`;
    if (SUMMARY_CACHE.has(cacheKey)) {
      return SUMMARY_CACHE.get(cacheKey)!;
    }

    const espnLeague = this.resolveEspnTarget(league).espnLeague;
    const fetched = await this.fetchSummaryRaw(eventId, league);

    if (!fetched) {
      return null;
    }
    const rawData = fetched.raw;

    try {
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
        logo: homeComp.team?.logo || homeComp.team?.logos?.[0]?.href,
        score: homeComp.score !== undefined ? parseInt(homeComp.score, 10) : undefined,
        isWinner: Boolean(homeComp.winner),
      };

      const awayTeam: MatchTeam = {
        id: String(awayComp.id || awayComp.team?.id || 'away'),
        name: awayComp.team?.displayName || awayComp.team?.name || 'Équipe 2',
        shortName: awayComp.team?.shortDisplayName || awayComp.team?.name,
        abbreviation: awayComp.team?.abbreviation,
        logo: awayComp.team?.logo || awayComp.team?.logos?.[0]?.href,
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

      const rostersData = rawData.rosters || [];
      const rosters: TeamRoster[] = rostersData.map((r: any) => {
        const allPlayers = r.roster || [];
        const extractAthletePhoto = (ath: any): string | undefined => {
          if (!ath) return undefined;
          if (typeof ath.headshot === 'string' && ath.headshot.trim()) return ath.headshot;
          if (ath.headshot?.href && typeof ath.headshot.href === 'string') return ath.headshot.href;
          if (ath.images && Array.isArray(ath.images) && ath.images[0]?.href) return ath.images[0].href;
          return undefined;
        };

        const mapPlayer = (p: any, isStarter: boolean): MatchPlayer => ({
          id: String(p.athlete?.id || p.id || ''),
          name: p.athlete?.displayName || p.athlete?.fullName || p.name || 'Joueur',
          shortName: p.athlete?.shortName || p.shortName,
          jersey: p.jersey || p.athlete?.jersey || (p.formationPlace ? String(p.formationPlace) : undefined),
          position: p.position?.abbreviation || p.position?.displayName || p.athlete?.position?.abbreviation,
          formationPlace: p.formationPlace,
          starter: isStarter,
          subbedIn: Boolean(p.subbedIn),
          subbedOut: Boolean(p.subbedOut),
          photo: extractAthletePhoto(p.athlete || p),
        });

        const rawStarters = allPlayers.filter((p: any) => p.starter === true).map((p: any) => mapPlayer(p, true));
        // Option A (Fallback) : Génération immédiate des positions terrain "row:col" à partir d'ESPN
        const starters = LiveScoreService.generateFieldPositionsFromEspn(r.formation, rawStarters);
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

      // ─── OPTION LIVESCORE EN PRIORITÉ ───
      // Tenter de récupérer compositions, remplacements, stade, arbitre et stats depuis LiveScore
      let liveScoreEnrichment: any = null;
      try {
        const matchDate = competition.date || header.date;
        liveScoreEnrichment = await LiveScoreService.fetchFullLiveScoreData(homeTeam.name, awayTeam.name, matchDate);
        if (liveScoreEnrichment && liveScoreEnrichment.rosters && liveScoreEnrichment.rosters.length >= 2) {
          const lsHome = liveScoreEnrichment.rosters[0];
          const lsAway = liveScoreEnrichment.rosters[1];

          if (lsHome.starters.length > 0 || lsAway.starters.length > 0) {
            const enrichWithPhotos = (lsStarters: MatchPlayer[], espnRoster?: TeamRoster): MatchPlayer[] => {
              if (!espnRoster) return lsStarters;
              return lsStarters.map((lsp) => {
                const espnMatch = espnRoster.starters.find(
                  (ep) =>
                    (ep.jersey && ep.jersey === lsp.jersey) ||
                    ep.name.toLowerCase().includes(lsp.name.toLowerCase()) ||
                    lsp.name.toLowerCase().includes(ep.name.toLowerCase())
                );
                return {
                  ...lsp,
                  photo: espnMatch?.photo || lsp.photo,
                };
              });
            };

            const finalHomeStarters = enrichWithPhotos(lsHome.starters, rosters[0]);
            const finalAwayStarters = enrichWithPhotos(lsAway.starters, rosters[1]);

            rosters[0] = {
              team: rosters[0]?.team || lsHome.team,
              formation: lsHome.formation || rosters[0]?.formation,
              starters: finalHomeStarters,
              bench: lsHome.bench.length > 0 ? lsHome.bench : rosters[0]?.bench || [],
            };

            rosters[1] = {
              team: rosters[1]?.team || lsAway.team,
              formation: lsAway.formation || rosters[1]?.formation,
              starters: finalAwayStarters,
              bench: lsAway.bench.length > 0 ? lsAway.bench : rosters[1]?.bench || [],
            };
          }
        }
      } catch (lsErr) {
        console.warn('[MatchesService] Fallback vers ESPN pour les compositions:', lsErr);
      }

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

      // Enrichissement des stats si ESPN en manquait
      const finalBoxscore =
        boxscore.length > 0 && boxscore.some((b) => b.statistics?.length > 0)
          ? boxscore
          : liveScoreEnrichment?.boxscore || boxscore;

      const finalVenue =
        venue ||
        (liveScoreEnrichment?.venueInfo
          ? `${liveScoreEnrichment.venueInfo.name}${liveScoreEnrichment.venueInfo.city ? ` (${liveScoreEnrichment.venueInfo.city})` : ''}`
          : undefined);

      const finalReferee = referee || liveScoreEnrichment?.refereeInfo?.name;

      const summary: MatchSummary = {
        id: String(header.id || eventId),
        title: `${homeTeam.name} vs ${awayTeam.name}`,
        status,
        statusText: competition.status?.type?.shortDetail || competition.status?.type?.description,
        minute: status === 'live' ? competition.status?.displayClock : undefined,
        startTime: competition.date || header.date || new Date().toISOString(),
        league: leagueInfo,
        venue: finalVenue,
        venueInfo: liveScoreEnrichment?.venueInfo,
        referee: finalReferee,
        refereeInfo: liveScoreEnrichment?.refereeInfo,
        homeTeam,
        awayTeam,
        boxscore: finalBoxscore,
        rosters,
        keyEvents,
        broadcasts: broadcasts.length > 0 ? broadcasts : undefined,
        isProbableLineup: liveScoreEnrichment?.isProbableLineup,
        substitutions: liveScoreEnrichment?.substitutions,
        coachHome: liveScoreEnrichment?.coachHome,
        coachAway: liveScoreEnrichment?.coachAway,
      };

      SUMMARY_CACHE.set(cacheKey, summary);
      return summary;
    } catch (parseError: any) {
      console.error(`[MatchesService] Erreur mapping summary ESPN (${eventId}):`, parseError);
      return null;
    }
  }
}

export const matchesService = new MatchesService();
