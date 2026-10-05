import { LRUCache } from 'lru-cache';
import { EspnClient } from '../espn/espn.client';
import { getLeagueByIdConfig, LEAGUES_CONFIG } from '../config/leagues.config';
import {
  PlayerProfile,
  PlayerStats,
  TeamRosterGroup,
  TeamDetails,
  CompetitionLeadersCategory,
  CompetitionLeader,
} from './teams.types';

const TEAMS_CACHE = new LRUCache<string, any>({
  max: 150,
  ttl: 300_000, // 5 minutes
});

const PLAYER_CACHE = new LRUCache<string, PlayerProfile>({
  max: 300,
  ttl: 600_000, // 10 minutes
});

export class TeamsService {
  /**
   * Parse un objet statistique brut d'un joueur en PlayerStats propre
   */
  private parsePlayerStats(rawStats: any): PlayerStats {
    const stats: PlayerStats = {};
    if (!rawStats?.splits?.categories) return stats;

    for (const cat of rawStats.splits.categories) {
      for (const item of cat.stats || []) {
        const val = Number(item.value ?? item.displayValue ?? 0);
        switch (item.name) {
          case 'appearances':
            stats.appearances = val;
            break;
          case 'subIns':
            stats.subIns = val;
            break;
          case 'totalGoals':
            stats.goals = val;
            break;
          case 'goalAssists':
            stats.assists = val;
            break;
          case 'totalShots':
            stats.shots = val;
            break;
          case 'shotsOnTarget':
            stats.shotsOnTarget = val;
            break;
          case 'yellowCards':
            stats.yellowCards = val;
            break;
          case 'redCards':
            stats.redCards = val;
            break;
          case 'foulsCommitted':
            stats.foulsCommitted = val;
            break;
          case 'foulsSuffered':
            stats.foulsSuffered = val;
            break;
          case 'saves':
            stats.saves = val;
            break;
          case 'goalsConceded':
            stats.goalsConceded = val;
            break;
        }
      }
    }
    return stats;
  }

  /**
   * Récupère la liste de toutes les équipes d'une ligue
   */
  async getLeagueTeams(leagueId: string): Promise<TeamDetails[]> {
    const league = getLeagueByIdConfig(leagueId);
    if (!league) return [];

    const cacheKey = `teams_league_${league.id}`;
    if (TEAMS_CACHE.has(cacheKey)) {
      return TEAMS_CACHE.get(cacheKey)!;
    }

    const isBasketball = league.sport === 'basketball';
    const sportPath = isBasketball ? 'basketball' : 'soccer';
    const endpoint = `/apis/site/v2/sports/${sportPath}/${league.espnLeague}/teams`;

    const data = await EspnClient.fetchJson<any>(endpoint);
    const rawTeams = data?.sports?.[0]?.leagues?.[0]?.teams || [];

    const teams: TeamDetails[] = rawTeams.map((item: any) => {
      const t = item.team || item;
      return {
        id: String(t.id),
        name: t.name,
        displayName: t.displayName || t.name,
        shortDisplayName: t.shortDisplayName || t.name,
        abbreviation: t.abbreviation,
        location: t.location,
        color: t.color ? `#${t.color}` : undefined,
        alternateColor: t.alternateColor ? `#${t.alternateColor}` : undefined,
        logo: t.logos?.[0]?.href || t.logo,
        standingSummary: t.standingSummary,
      };
    });

    if (teams.length > 0) {
      TEAMS_CACHE.set(cacheKey, teams);
    }

    return teams;
  }

  /**
   * Récupère la fiche détaillée d'une équipe
   */
  async getTeamDetails(teamId: string, leagueId?: string): Promise<TeamDetails | null> {
    const cacheKey = `team_details_${teamId}_${leagueId || 'all'}`;
    if (TEAMS_CACHE.has(cacheKey)) {
      return TEAMS_CACHE.get(cacheKey)!;
    }

    let sportPath = 'soccer';
    let espnLeague = 'eng.1';

    if (leagueId) {
      const config = getLeagueByIdConfig(leagueId);
      if (config) {
        espnLeague = config.espnLeague;
        sportPath = config.sport === 'basketball' ? 'basketball' : 'soccer';
      } else {
        espnLeague = leagueId;
      }
    }

    let data = await EspnClient.fetchJson<any>(
      `/apis/site/v2/sports/${sportPath}/${espnLeague}/teams/${teamId}`
    );

    if (!data?.team && sportPath === 'soccer') {
      // Tenter sur les autres ligues principales
      for (const testL of ['fra.1', 'esp.1', 'ita.1', 'ger.1', 'uefa.champions']) {
        data = await EspnClient.fetchJson<any>(
          `/apis/site/v2/sports/soccer/${testL}/teams/${teamId}`
        );
        if (data?.team) break;
      }
    }

    if (!data?.team) return null;

    const t = data.team;
    const details: TeamDetails = {
      id: String(t.id),
      name: t.name,
      displayName: t.displayName || t.name,
      shortDisplayName: t.shortDisplayName || t.name,
      abbreviation: t.abbreviation,
      location: t.location,
      color: t.color ? `#${t.color}` : undefined,
      alternateColor: t.alternateColor ? `#${t.alternateColor}` : undefined,
      logo: t.logos?.[0]?.href || t.logo,
      standingSummary: t.standingSummary,
      record: t.record?.items?.[0]?.summary,
      venue: t.venue
        ? {
            id: t.venue.id,
            name: t.venue.fullName,
            city: t.venue.address?.city,
            capacity: t.venue.capacity,
          }
        : undefined,
    };

    TEAMS_CACHE.set(cacheKey, details);
    return details;
  }

  /**
   * Récupère l'effectif complet (Roster) d'une équipe, groupé par poste
   */
  async getTeamRoster(teamId: string, leagueId?: string): Promise<TeamRosterGroup[]> {
    const cacheKey = `roster_${teamId}_${leagueId || 'all'}`;
    if (TEAMS_CACHE.has(cacheKey)) {
      return TEAMS_CACHE.get(cacheKey)!;
    }

    let sportPath = 'soccer';
    let espnLeague = 'eng.1';

    if (leagueId) {
      const config = getLeagueByIdConfig(leagueId);
      if (config) {
        espnLeague = config.espnLeague;
        sportPath = config.sport === 'basketball' ? 'basketball' : 'soccer';
      }
    }

    let data = await EspnClient.fetchJson<any>(
      `/apis/site/v2/sports/${sportPath}/${espnLeague}/teams/${teamId}/roster`
    );

    if (!data?.athletes && sportPath === 'soccer') {
      for (const testL of ['fra.1', 'esp.1', 'ita.1', 'ger.1', 'uefa.champions']) {
        data = await EspnClient.fetchJson<any>(
          `/apis/site/v2/sports/soccer/${testL}/teams/${teamId}/roster`
        );
        if (data?.athletes?.length) break;
      }
    }

    if (!data?.athletes || !Array.isArray(data.athletes)) return [];

    const teamInfo = data.team
      ? {
          id: String(data.team.id),
          name: data.team.name,
          displayName: data.team.displayName || data.team.name,
          logo: data.team.logo || data.team.logos?.[0]?.href,
        }
      : undefined;

    const positionGroupsMap = new Map<string, PlayerProfile[]>();

    for (const a of data.athletes) {
      const posName = a.position?.displayName || a.position?.name || 'Joueurs';
      if (!positionGroupsMap.has(posName)) {
        positionGroupsMap.set(posName, []);
      }

      const player: PlayerProfile = {
        id: String(a.id),
        name: a.name || a.displayName,
        fullName: a.fullName || a.displayName,
        displayName: a.displayName || a.name,
        shortName: a.shortName,
        jersey: a.jersey,
        position: {
          id: a.position?.id,
          name: a.position?.name || posName,
          displayName: a.position?.displayName || posName,
          abbreviation: a.position?.abbreviation || '',
        },
        age: a.age,
        dateOfBirth: a.dateOfBirth,
        displayHeight: a.displayHeight,
        displayWeight: a.displayWeight,
        citizenship: a.citizenship,
        countryCode: a.citizenshipCountry?.abbreviation,
        flag: a.flag?.href,
        photo: a.headshot?.href,
        team: teamInfo,
        statistics: this.parsePlayerStats(a.statistics),
      };

      positionGroupsMap.get(posName)!.push(player);
    }

    const groups: TeamRosterGroup[] = [];
    const orderedPositions = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

    for (const pos of orderedPositions) {
      if (positionGroupsMap.has(pos)) {
        groups.push({
          position: pos,
          players: positionGroupsMap.get(pos)!,
        });
        positionGroupsMap.delete(pos);
      }
    }

    // Ajouter les autres postes restants
    for (const [pos, players] of positionGroupsMap.entries()) {
      groups.push({ position: pos, players });
    }

    if (groups.length > 0) {
      TEAMS_CACHE.set(cacheKey, groups);
    }

    return groups;
  }

  /**
   * Récupère la fiche détaillée d'un joueur
   */
  async getPlayerProfile(athleteId: string, sport: string = 'soccer'): Promise<PlayerProfile | null> {
    const cacheKey = `player_${athleteId}_${sport}`;
    if (PLAYER_CACHE.has(cacheKey)) {
      return PLAYER_CACHE.get(cacheKey)!;
    }

    const data = await EspnClient.fetchJson<any>(
      `/apis/common/v3/sports/${sport}/athletes/${athleteId}`
    );

    if (!data?.athlete) return null;

    const a = data.athlete;
    const statsSummary = (a.statsSummary?.statistics || []).map((s: any) => ({
      name: s.name,
      displayName: s.displayName,
      value: s.displayValue ?? s.value,
    }));

    const player: PlayerProfile = {
      id: String(a.id),
      name: a.name || a.displayName,
      fullName: a.fullName || a.displayName,
      displayName: a.displayName || a.name,
      shortName: a.shortName,
      jersey: a.jersey,
      position: {
        id: a.position?.id,
        name: a.position?.name || 'Player',
        displayName: a.position?.displayName || 'Player',
        abbreviation: a.position?.abbreviation || '',
      },
      age: a.age,
      dateOfBirth: a.dateOfBirth,
      displayHeight: a.displayHeight,
      displayWeight: a.displayWeight,
      citizenship: a.citizenship,
      countryCode: a.citizenshipCountry?.abbreviation,
      flag: a.flag?.href,
      photo: a.headshot?.href,
      team: a.team
        ? {
            id: String(a.team.id),
            name: a.team.name,
            displayName: a.team.displayName || a.team.name,
            logo: a.team.logos?.[0]?.href || a.team.logo,
          }
        : undefined,
      statsSummary: statsSummary.length > 0 ? statsSummary : undefined,
    };

    PLAYER_CACHE.set(cacheKey, player);
    return player;
  }

  /**
   * Récupère les Top Buteurs et Top Passeurs d'une compétition
   */
  async getCompetitionLeaders(leagueId: string): Promise<CompetitionLeadersCategory[]> {
    const league = getLeagueByIdConfig(leagueId);
    if (!league) return [];

    const cacheKey = `leaders_${league.id}`;
    if (TEAMS_CACHE.has(cacheKey)) {
      return TEAMS_CACHE.get(cacheKey)!;
    }

    const isBasketball = league.sport === 'basketball';
    const sportPath = isBasketball ? 'basketball' : 'soccer';
    const endpoint = `/apis/site/v2/sports/${sportPath}/${league.espnLeague}/statistics`;

    const data = await EspnClient.fetchJson<any>(endpoint);
    if (!data?.stats || !Array.isArray(data.stats)) return [];

    const categories: CompetitionLeadersCategory[] = [];

    for (const cat of data.stats) {
      const leadersList: CompetitionLeader[] = (cat.leaders || []).map((l: any, idx: number) => ({
        rank: idx + 1,
        athlete: {
          id: String(l.athlete?.id || ''),
          displayName: l.athlete?.displayName || l.athlete?.name || 'Joueur',
          shortName: l.athlete?.shortName,
          headshot: l.athlete?.headshot?.href,
          jersey: l.athlete?.jersey,
          position: l.athlete?.position?.displayName || l.athlete?.position?.name,
        },
        team: l.team
          ? {
              id: String(l.team.id),
              name: l.team.name,
              displayName: l.team.displayName || l.team.name,
              logo: l.team.logos?.[0]?.href,
            }
          : undefined,
        value: Number(l.value || 0),
        displayValue: String(l.displayValue ?? l.value ?? '0'),
      }));

      categories.push({
        name: cat.name,
        displayName: cat.displayName || cat.name,
        leaders: leadersList,
      });
    }

    if (categories.length > 0) {
      TEAMS_CACHE.set(cacheKey, categories, { ttl: 120_000 });
    }

    return categories;
  }
}

export const teamsService = new TeamsService();
