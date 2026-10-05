export type MatchStatus = 'live' | 'upcoming' | 'finished' | 'postponed' | 'cancelled';
export type SportType = 'football' | 'basketball' | 'tennis' | 'rugby' | 'other';

export interface MatchTeam {
  id: string;
  name: string;
  shortName?: string;
  abbreviation?: string;
  logo?: string;
  score?: number;
  isWinner?: boolean;
}

export interface MatchLeague {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
  country?: string;
  flag?: string;
}

export interface SportMatch {
  id: string;
  title: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  status: MatchStatus;
  statusText?: string;
  minute?: string;
  period?: string;
  startTime: string; // ISO 8601
  startTimestamp: number;
  league: MatchLeague;
  venue?: string;
  broadcast?: string[];
  sport: SportType;
  highlightsUrl?: string;
}

export interface MatchesFilterOptions {
  status?: 'all' | 'live' | 'upcoming' | 'finished';
  league?: string;
  date?: string; // YYYY-MM-DD
  sport?: SportType | 'all';
  search?: string;
}

export interface MatchStatistic {
  name: string;
  label: string;
  displayValue: string;
}

export interface TeamBoxscore {
  team: {
    id: string;
    name: string;
    abbreviation?: string;
    logo?: string;
  };
  statistics: MatchStatistic[];
}

export interface MatchPlayer {
  id: string;
  name: string;
  shortName?: string;
  jersey?: string;
  position?: string;
  formationPlace?: string;
  starter: boolean;
  subbedIn?: boolean;
  subbedOut?: boolean;
  photo?: string;
}

export interface TeamRoster {
  team: {
    id: string;
    name: string;
    abbreviation?: string;
    logo?: string;
  };
  formation?: string;
  starters: MatchPlayer[];
  bench: MatchPlayer[];
}

export interface MatchKeyEvent {
  id: string;
  type: string;
  clock?: string;
  period?: number;
  text: string;
  shortText?: string;
  scoringPlay?: boolean;
  teamId?: string;
  teamName?: string;
  participants?: Array<{
    id: string;
    name: string;
  }>;
}

export interface MatchSummary {
  id: string;
  title: string;
  status: MatchStatus;
  statusText?: string;
  minute?: string;
  startTime: string;
  league: MatchLeague;
  venue?: string;
  referee?: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  boxscore: TeamBoxscore[];
  rosters: TeamRoster[];
  keyEvents: MatchKeyEvent[];
  broadcasts?: string[];
}
