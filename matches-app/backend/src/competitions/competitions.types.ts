import { MatchTeam, MatchLeague } from '../matches/matches.types';

export interface StandingEntry {
  rank: number;
  rankChange?: number;
  team: MatchTeam;
  gamesPlayed: number;
  wins: number;
  ties: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  pointsPerGame?: number;
  form?: string; // ex: 'W,W,D,L,W'
  note?: {
    color?: string;
    description?: string;
  };
}

export interface StandingGroup {
  id: string;
  name: string;
  abbreviation?: string;
  seasonYear: number;
  seasonDisplayName?: string;
  entries: StandingEntry[];
}

export interface CompetitionSeason {
  year: number;
  displayName: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}

export interface CompetitionDetails {
  league: MatchLeague;
  currentSeason: number;
  seasons: CompetitionSeason[];
  hasStandings: boolean;
  standings?: StandingGroup[];
}
