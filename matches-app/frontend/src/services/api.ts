import axios from 'axios';
import type {
  SportMatch,
  MatchLeague,
  MatchSummary,
  MatchesFilterOptions,
  CountryInfo,
  CompetitionDetails,
  StandingGroup,
  CompetitionSeason,
  DetailedMatchAnalysis,
  TeamDetails,
  TeamRosterGroup,
  PlayerProfile,
  CompetitionLeadersCategory,
} from '../types/matches';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});

/**
 * Origine de l'API. Les relay HLS du backend (`/api/liveball/...`,
 * `/api/sports/...`) sont renvoyés en chemin relatif : sans ce préfixe le
 * player les demanderait à l'origine du front (Vite :5173) et recevrait 404.
 */
export const API_ORIGIN = ((): string => {
  try {
    return new URL(API_BASE_URL, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').origin;
  } catch {
    return '';
  }
})();

export function absoluteApiUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return /^https?:\/\//i.test(path) ? path : `${API_ORIGIN}${path}`;
}

// ─── 1. Matchs & Filtres ───

export async function fetchMatches(options: MatchesFilterOptions = {}): Promise<SportMatch[]> {
  try {
    const params: Record<string, string> = {};
    if (options.status && options.status !== 'all') params.status = options.status;
    if (options.country && options.country !== 'all') params.country = options.country;
    if (options.league && options.league !== 'all') params.league = options.league;
    if (options.date) params.date = options.date;
    if (options.month) params.month = options.month;
    if (options.season) params.season = String(options.season);
    if (options.seasontype) params.seasontype = String(options.seasontype);
    if (options.sport && options.sport !== 'all') params.sport = options.sport;
    if (options.search) params.search = options.search;
    if (options.limit) params.limit = String(options.limit);

    const res = await apiClient.get<{ success: boolean; data: SportMatch[] }>('/matches', { params });
    return res.data?.data || [];
  } catch (err) {
    console.error('[API] Error fetching matches:', err);
    return [];
  }
}

export async function fetchCountries(): Promise<CountryInfo[]> {
  try {
    const res = await apiClient.get<{ success: boolean; data: CountryInfo[] }>('/matches/countries');
    return res.data?.data || [];
  } catch (err) {
    console.error('[API] Error fetching countries:', err);
    return [];
  }
}

export async function fetchLeagues(countryId?: string): Promise<MatchLeague[]> {
  try {
    const url = countryId && countryId !== 'all'
      ? `/matches/countries/${encodeURIComponent(countryId)}/leagues`
      : '/matches/leagues';
    const res = await apiClient.get<{ success: boolean; data: MatchLeague[] }>(url);
    return res.data?.data || [];
  } catch (err) {
    console.error('[API] Error fetching leagues:', err);
    return [];
  }
}

export async function fetchMatchById(id: string): Promise<SportMatch | null> {
  try {
    const res = await apiClient.get<{ success: boolean; data: SportMatch }>(`/matches/${encodeURIComponent(id)}`);
    return res.data?.data || null;
  } catch (err) {
    console.error(`[API] Error fetching match ${id}:`, err);
    return null;
  }
}

export async function fetchMatchSummary(id: string, league?: string): Promise<MatchSummary | null> {
  try {
    const params: Record<string, string> = {};
    if (league && league !== 'all') params.league = league;

    const res = await apiClient.get<{ success: boolean; data: MatchSummary }>(
      `/matches/${encodeURIComponent(id)}/summary`,
      { params }
    );
    return res.data?.data || null;
  } catch (err) {
    console.error(`[API] Error fetching summary for match ${id}:`, err);
    return null;
  }
}

export async function fetchMatchAnalysis(id: string, league?: string): Promise<DetailedMatchAnalysis | null> {
  try {
    const params: Record<string, string> = {};
    if (league && league !== 'all') params.league = league;

    const res = await apiClient.get<{ success: boolean; data: DetailedMatchAnalysis }>(
      `/matches/${encodeURIComponent(id)}/analysis`,
      { params }
    );
    return res.data?.data || null;
  } catch (err) {
    console.error(`[API] Error fetching analysis for match ${id}:`, err);
    return null;
  }
}

// ─── 2. Compétitions & Classements ───

export async function fetchCompetitionDetails(leagueId: string, season?: number | string): Promise<CompetitionDetails | null> {
  try {
    const params: Record<string, string> = {};
    if (season) params.season = String(season);

    const res = await apiClient.get<{ success: boolean; data: CompetitionDetails }>(
      `/competitions/${encodeURIComponent(leagueId)}`,
      { params }
    );
    return res.data?.data || null;
  } catch (err) {
    console.error(`[API] Error fetching competition details for ${leagueId}:`, err);
    return null;
  }
}

export async function fetchStandings(leagueId: string, season?: number | string): Promise<StandingGroup[]> {
  try {
    const params: Record<string, string> = {};
    if (season) params.season = String(season);

    const res = await apiClient.get<{ success: boolean; data: StandingGroup[] }>(
      `/competitions/${encodeURIComponent(leagueId)}/standings`,
      { params }
    );
    return res.data?.data || [];
  } catch (err) {
    console.error(`[API] Error fetching standings for ${leagueId}:`, err);
    return [];
  }
}

export async function fetchSeasons(leagueId: string): Promise<CompetitionSeason[]> {
  try {
    const res = await apiClient.get<{ success: boolean; data: CompetitionSeason[] }>(
      `/competitions/${encodeURIComponent(leagueId)}/seasons`
    );
    return res.data?.data || [];
  } catch (err) {
    console.error(`[API] Error fetching seasons for ${leagueId}:`, err);
    return [];
  }
}

export async function fetchCompetitionLeaders(leagueId: string): Promise<CompetitionLeadersCategory[]> {
  try {
    const res = await apiClient.get<{ success: boolean; data: CompetitionLeadersCategory[] }>(
      `/competitions/${encodeURIComponent(leagueId)}/leaders`
    );
    return res.data?.data || [];
  } catch (err) {
    console.error(`[API] Error fetching leaders for ${leagueId}:`, err);
    return [];
  }
}

export async function fetchCompetitionMatches(
  leagueId: string,
  options: { status?: string; season?: string | number; date?: string; limit?: number } = {}
): Promise<SportMatch[]> {
  try {
    const params: Record<string, string> = {};
    if (options.status && options.status !== 'all') params.status = options.status;
    if (options.season) params.season = String(options.season);
    if (options.date) params.date = options.date;
    if (options.limit) params.limit = String(options.limit);

    const res = await apiClient.get<{ success: boolean; data: SportMatch[] }>(
      `/competitions/${encodeURIComponent(leagueId)}/matches`,
      { params }
    );
    return res.data?.data || [];
  } catch (err) {
    console.error(`[API] Error fetching matches for league ${leagueId}:`, err);
    return [];
  }
}

// ─── 3. Équipes & Joueurs ───

export async function fetchLeagueTeams(leagueId: string): Promise<TeamDetails[]> {
  try {
    const res = await apiClient.get<{ success: boolean; data: TeamDetails[] }>(
      `/competitions/${encodeURIComponent(leagueId)}/teams`
    );
    return res.data?.data || [];
  } catch (err) {
    console.error(`[API] Error fetching teams for league ${leagueId}:`, err);
    return [];
  }
}

export async function fetchTeamDetails(teamId: string, league?: string): Promise<TeamDetails | null> {
  try {
    const params: Record<string, string> = {};
    if (league) params.league = league;

    const res = await apiClient.get<{ success: boolean; data: TeamDetails }>(
      `/teams/${encodeURIComponent(teamId)}`,
      { params }
    );
    return res.data?.data || null;
  } catch (err) {
    console.error(`[API] Error fetching team ${teamId}:`, err);
    return null;
  }
}

export async function fetchTeamRoster(teamId: string, league?: string): Promise<TeamRosterGroup[]> {
  try {
    const params: Record<string, string> = {};
    if (league) params.league = league;

    const res = await apiClient.get<{ success: boolean; data: TeamRosterGroup[] }>(
      `/teams/${encodeURIComponent(teamId)}/roster`,
      { params }
    );
    return res.data?.data || [];
  } catch (err) {
    console.error(`[API] Error fetching roster for team ${teamId}:`, err);
    return [];
  }
}

export async function fetchPlayerProfile(playerId: string, sport: string = 'soccer'): Promise<PlayerProfile | null> {
  try {
    const res = await apiClient.get<{ success: boolean; data: PlayerProfile }>(
      `/players/${encodeURIComponent(playerId)}`,
      { params: { sport } }
    );
    return res.data?.data || null;
  } catch (err) {
    console.error(`[API] Error fetching player profile ${playerId}:`, err);
    return null;
  }
}

// ─── 4. Streams ───

/** Un serveur de lecture proposé par `GET /matches/:id/stream`. */
export interface StreamServer {
  id?: string;
  name: string;
  url: string;
  type: 'hls' | 'iframe';
  /**
   * Relay HLS géré par le backend (`/api/sports/...`) :
   * playlists et segments passent par notre serveur (referer + IP stables).
   */
  relayUrl?: string;
  provider?: string;
  referer?: string;
  isPrimary?: boolean;
  external?: boolean;
}

/** `data` de `GET /matches/:id/stream`. */
export interface StreamResolution {
  success?: boolean;
  matchId: string;
  homeTeam?: string;
  awayTeam?: string;
  status?: 'resolved' | 'not_found' | 'error';
  source?: string;
  sourceMatchId?: string;
  primaryUrl?: string;
  primaryType?: 'hls' | 'iframe';
  url?: string;
  type?: 'hls' | 'iframe';
  relayUrl?: string;
  directUrl?: string;
  referer?: string;
  provider?: string;
  servers: StreamServer[];
  message?: string;
  complete?: boolean;
}

export async function fetchMatchStream(id: string, home?: string, away?: string): Promise<StreamResolution | null> {
  try {
    const params: Record<string, string> = {};
    if (home) params.home = home;
    if (away) params.away = away;

    // `/api/matches/:id/stream` renvoie la résolution à plat (sans enveloppe `data`).
    const res = await apiClient.get<StreamResolution & { data?: StreamResolution | null }>(
      `/matches/${encodeURIComponent(id)}/stream`,
      { params, timeout: 35_000 },
    );
    const payload = res.data;
    const resolution = payload?.data ?? payload;
    if (!resolution || (!resolution.primaryUrl && !resolution.url && !resolution.servers?.length)) {
      return null;
    }
    return resolution;
  } catch (err) {
    console.warn(`[API] Stream not found for match ${id}:`, err);
    return null;
  }
}

/** Résolution directe par identifiant sports (`kora:123`, slug ou sourceId). */
export async function fetchSportsStream(id: string): Promise<StreamResolution | null> {
  try {
    const res = await apiClient.get<{ success: boolean; data: StreamResolution | null; message?: string | null }>(
      `/sports/match/${encodeURIComponent(id)}/stream`,
      { timeout: 35_000 },
    );
    if (!res.data?.success || !res.data.data) return null;
    return res.data.data;
  } catch (err) {
    console.warn(`[API] Sports stream not found for ${id}:`, err);
    return null;
  }
}

/** Tous les serveurs connus du match (agrégation multi-providers). */
export async function fetchSportsChannels(id: string): Promise<StreamResolution | null> {
  try {
    const res = await apiClient.get<{ success: boolean; data: StreamResolution | null; message?: string | null }>(
      `/sports/match/${encodeURIComponent(id)}/channels`,
      { timeout: 40_000 },
    );
    if (!res.data?.success || !res.data.data) return null;
    return res.data.data;
  } catch (err) {
    console.warn(`[API] Sports channels not found for ${id}:`, err);
    return null;
  }
}

export interface MatchChannelStatus {
  channel: import('../types/oha').OhaChannel;
  confirmed: boolean;
  matchedTitle?: string;
}

/** Chaînes CHILLERS candidates pour un match (EPG confirmé d'abord). */
export async function fetchMatchChannels(info: {
  sport?: string;
  league?: string;
  home?: string;
  away?: string;
  start?: string | number;
}): Promise<MatchChannelStatus[]> {
  try {
    const res = await apiClient.get<{ success: boolean; data?: MatchChannelStatus[]; message?: string }>(
      '/live/match-channels',
      {
        params: {
          sport: info.sport,
          league: info.league,
          home: info.home,
          away: info.away,
          start: info.start != null ? String(info.start) : undefined,
        },
        timeout: 20_000,
      },
    );
    return res.data?.success && Array.isArray(res.data.data) ? res.data.data : [];
  } catch (err) {
    console.warn('[API] Match channels unavailable:', err);
    return [];
  }
}

/** Résout un id OHA en URL HLS jouable (sources alternatives incluses). */
export async function resolveOhaStream(id: string, altIds: string[] = []): Promise<string> {
  const res = await apiClient.get<{ success: boolean; data?: { url: string }; message?: string }>(
    '/live/oha/resolve',
    {
      params: { id, alts: altIds.length > 0 ? altIds.join(',') : undefined },
      timeout: 25_000,
    },
  );
  if (!res.data?.success || !res.data.data?.url) {
    throw new Error(res.data?.message || 'stream unresolved');
  }
  return res.data.data.url;
}

// ─── 5. Simulation SSE Test ───
export async function simulateTestGoal(matchId?: string) {
  try {
    const res = await apiClient.post('/matches/live/sse/test-goal', { matchId });
    return res.data;
  } catch (err) {
    console.error('[API] Error simulating test goal:', err);
    return null;
  }
}

