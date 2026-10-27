export type MatchStatus = 'live' | 'upcoming' | 'finished' | 'postponed' | 'cancelled';
export type SportType = 'football' | 'basketball' | 'tennis' | 'volleyball' | 'other';

export interface MatchTeam {
  id: string;
  name: string;
  shortName?: string;
  abbreviation?: string;
  logo?: string;
  score?: number;
  halfTimeScore?: number;
  penaltyScore?: number;
  isWinner?: boolean;
}

export interface CountryInfo {
  id: string; // e.g. 'england', 'spain', 'france', etc.
  name: string; // e.g. 'Angleterre', 'Espagne', 'France'
  code: string; // e.g. 'GB-ENG', 'ES', 'FR'
  flag: string; // Flag emoji or URL
  leaguesCount: number;
}

export interface MatchLeague {
  id: string;
  name: string;
  slug?: string;
  espnLeague?: string;
  logo?: string;
  country?: string;
  countryId?: string;
  countryCode?: string;
  flag?: string;
  seasonYear?: number;
  seasonSlug?: string;
  sport?: SportType;
}

export interface SportMatch {
  id: string;
  title: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  status: MatchStatus;
  statusText?: string;
  statusShort?: string;
  minute?: string;
  period?: string;
  periodNum?: number;
  rawClock?: number;
  clockUpdatedAt?: number;
  startTime: string; // ISO 8601
  startTimestamp: number;
  league: MatchLeague;
  group?: string; // Poule / Groupe (ex: "League A: Group 1", "Groupe A", "Poule B")
  stage?: string; // Phase / Tour de compétition
  venue?: string;
  broadcast?: string[];
  sport: SportType;
  highlightsUrl?: string;
}

export interface MatchesFilterOptions {
  status?: 'all' | 'live' | 'upcoming' | 'finished';
  country?: string; // id du pays, ex: 'england', 'france'
  league?: string; // id ou slug du championnat, ex: 'eng.1', 'premier-league'
  date?: string; // YYYY-MM-DD ou YYYYMMDD
  month?: string; // YYYY-MM ou YYYYMM (ex: 202409 pour tout le mois de septembre 2024)
  season?: string | number; // Année de la saison, ex: 2024, 2025, 2026
  seasontype?: string | number; // 1=pré-saison, 2=saison régulière, 3=post-saison
  sport?: SportType | 'all';
  search?: string;
  limit?: number;
  bypassCache?: boolean;
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
  fieldPosition?: string; // LiveScore matrix "row:col" (e.g. "1:1", "2:4")
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

export interface MatchSubstitution {
  minute: string;
  teamId?: string;
  playerInName: string;
  playerInJersey?: string;
  playerOutName: string;
  playerOutJersey?: string;
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
  isProbableLineup?: boolean;
  refereeInfo?: { name: string; country?: string; image?: string };
  venueInfo?: { name: string; city?: string; capacity?: number };
  substitutions?: MatchSubstitution[];
  coachHome?: string;
  coachAway?: string;
}
