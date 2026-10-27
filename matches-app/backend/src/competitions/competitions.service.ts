import { LRUCache } from 'lru-cache';
import { EspnClient } from '../espn/espn.client';
import { getLeagueByIdConfig, LeagueConfig } from '../config/leagues.config';
import {
  StandingGroup,
  StandingEntry,
  CompetitionSeason,
  CompetitionDetails,
} from './competitions.types';
import { MatchTeam } from '../matches/matches.types';

const STANDINGS_CACHE = new LRUCache<string, StandingGroup[]>({
  max: 100,
  ttl: 60_000, // 1 minute
});

const SEASONS_CACHE = new LRUCache<string, CompetitionSeason[]>({
  max: 50,
  ttl: 3600_000, // 1 heure
});

export class CompetitionsService {
  /**
   * Récupère le classement officiel (standings) d'un championnat pour une saison donnée
   */
  async getStandings(leagueId: string, season?: number | string): Promise<StandingGroup[]> {
    const league = getLeagueByIdConfig(leagueId);
    if (!league) return [];

    const seasonParam = season ? String(season) : '';
    const cacheKey = `standings_${league.id}_${seasonParam || 'current'}`;

    if (STANDINGS_CACHE.has(cacheKey)) {
      return STANDINGS_CACHE.get(cacheKey)!;
    }

    try {
      const isBasketball = league.sport === 'basketball';
      const sportPath = isBasketball ? 'basketball' : 'soccer';
      const queryStr = seasonParam ? `?season=${seasonParam}` : '';
      const endpoint = `/apis/v2/sports/${sportPath}/${league.espnLeague}/standings${queryStr}`;

      const rawData = await EspnClient.fetchJson<any>(endpoint, { timeout: 9000 });
      if (!rawData) return [];

      const groups: StandingGroup[] = [];
      const children = Array.isArray(rawData.children) ? rawData.children : [rawData];

      for (const groupItem of children) {
        const entriesRaw = groupItem.standings?.entries || [];
        if (!Array.isArray(entriesRaw) || entriesRaw.length === 0) continue;

        const entries: StandingEntry[] = [];

        for (const item of entriesRaw) {
          const statsMap: Record<string, number> = {};
          for (const stat of item.stats || []) {
            if (stat.name && stat.value !== undefined) {
              statsMap[stat.name] = Number(stat.value);
            }
          }

          const teamData = item.team || {};
          const team: MatchTeam = {
            id: String(teamData.id || ''),
            name: teamData.displayName || teamData.name || 'Équipe',
            shortName: teamData.shortDisplayName || teamData.name,
            abbreviation: teamData.abbreviation,
            logo: teamData.logos?.[0]?.href || teamData.logo,
          };

          const rank = statsMap['rank'] !== undefined ? statsMap['rank'] : entries.length + 1;
          const rankChange = statsMap['rankChange'] || 0;
          const gamesPlayed = statsMap['gamesPlayed'] || 0;
          const wins = statsMap['wins'] || 0;
          const ties = statsMap['ties'] || 0;
          const losses = statsMap['losses'] || 0;
          const points = statsMap['points'] || 0;
          const goalsFor = statsMap['pointsFor'] || 0;
          const goalsAgainst = statsMap['pointsAgainst'] || 0;
          const goalDifference = statsMap['pointDifferential'] !== undefined
            ? statsMap['pointDifferential']
            : goalsFor - goalsAgainst;

          const note = item.note
            ? {
                color: item.note.color,
                description: item.note.description,
              }
            : undefined;

          entries.push({
            rank,
            rankChange,
            team,
            gamesPlayed,
            wins,
            ties,
            losses,
            points,
            goalsFor,
            goalsAgainst,
            goalDifference,
            pointsPerGame: statsMap['ppg'],
            note,
          });
        }

        // Tri par rang croissant
        entries.sort((a, b) => a.rank - b.rank);

        groups.push({
          id: String(groupItem.id || '1'),
          name: groupItem.name || rawData.name || league.name,
          abbreviation: groupItem.abbreviation,
          seasonYear: Number(groupItem.season || seasonParam || new Date().getFullYear()),
          seasonDisplayName: groupItem.name,
          entries,
        });
      }

      if (groups.length > 0) {
        STANDINGS_CACHE.set(cacheKey, groups);
      }

      return groups;
    } catch (err: any) {
      console.warn(`[CompetitionsService] Erreur standings ligue ${leagueId}:`, err.message);
      return [];
    }
  }

  /**
   * Récupère la liste des saisons disponibles pour un championnat
   */
  async getSeasons(leagueId: string): Promise<CompetitionSeason[]> {
    const league = getLeagueByIdConfig(leagueId);
    if (!league) return [];

    const cacheKey = `seasons_${league.id}`;
    if (SEASONS_CACHE.has(cacheKey)) {
      return SEASONS_CACHE.get(cacheKey)!;
    }

    try {
      const isBasketball = league.sport === 'basketball';
      const sportPath = isBasketball ? 'basketball' : 'soccer';
      const endpoint = `https://sports.core.api.espn.com/v2/sports/${sportPath}/leagues/${league.espnLeague}/seasons`;

      const data = await EspnClient.fetchJson<any>(endpoint, { timeout: 6000 });
      let years: number[] = [];

      if (data?.items && Array.isArray(data.items)) {
        for (const it of data.items) {
          const match = String(it.$ref || '').match(/\/seasons\/(\d{4})/);
          if (match && match[1]) {
            years.push(parseInt(match[1], 10));
          }
        }
      }

      // Si l'API core n'a pas répondu, générer les 10 dernières saisons jusqu'à aujourd'hui
      if (years.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 8; y--) {
          years.push(y);
        }
      }

      // Supprimer doublons et trier du plus récent au plus ancien
      years = Array.from(new Set(years)).sort((a, b) => b - a);

      const currentYear = years[0] || new Date().getFullYear();
      const seasons: CompetitionSeason[] = years.map((year) => ({
        year,
        displayName: `${year}-${year + 1}`,
        isCurrent: year === currentYear,
      }));

      SEASONS_CACHE.set(cacheKey, seasons);
      return seasons;
    } catch (err: any) {
      console.warn(`[CompetitionsService] Erreur saisons pour ${leagueId}:`, err.message);
      return [];
    }
  }

  /**
   * Récupère les détails complets d'une compétition :
   * Métadonnées, saisons disponibles, et classement
   */
  async getCompetitionDetails(
    leagueId: string,
    season?: number | string
  ): Promise<CompetitionDetails | null> {
    const league = getLeagueByIdConfig(leagueId);
    if (!league) return null;

    const seasons = await this.getSeasons(leagueId);
    const currentSeason = seasons[0]?.year || new Date().getFullYear();
    const targetSeason = season ? Number(season) : currentSeason;

    const standings = league.hasStandings
      ? await this.getStandings(leagueId, targetSeason)
      : undefined;

    return {
      league: {
        id: league.id,
        name: league.name,
        slug: league.slug,
        espnLeague: league.espnLeague,
        logo: league.logo,
        country: league.country,
        countryId: league.countryId,
        countryCode: league.countryCode,
        flag: league.flag,
        seasonYear: targetSeason,
      },
      currentSeason,
      seasons,
      hasStandings: Boolean(league.hasStandings),
      standings,
    };
  }
}

export const competitionsService = new CompetitionsService();
