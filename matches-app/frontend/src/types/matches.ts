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
  players?: Array<{ name: string; position?: string; [key: string]: any }>;
}

export interface CountryInfo {
  id: string;
  name: string;
  code: string;
  flag: string;
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
  sport?: SportType;
  seasonYear?: number;
  seasonSlug?: string;
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
  country?: string;
  league?: string;
  date?: string; // YYYY-MM-DD ou YYYYMMDD
  month?: string; // YYYY-MM ou YYYYMM
  season?: string | number;
  seasontype?: string | number;
  sport?: SportType | 'all';
  search?: string;
  limit?: number;
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

// ─── Phase 2 : Compétitions & Classements ───
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
  form?: string;
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

// ─── Phase 3 : Analyse Détaillée ───
export interface MatchOdds {
  provider?: string;
  details?: string;
  overUnder?: number;
  spread?: number;
  homeMoneyLine?: number;
  awayMoneyLine?: number;
  drawMoneyLine?: number;
  homeWinProbability?: number;
  drawProbability?: number;
  awayWinProbability?: number;
}

export interface WinProbabilityPoint {
  playId?: string;
  clock?: string;
  period?: number;
  homeWinPercentage: number;
  tiePercentage: number;
  awayWinPercentage: number;
  text?: string;
}

export interface MatchCommentaryItem {
  sequence: number;
  clock?: string;
  period?: number;
  text: string;
}

export interface HeadToHeadMatch {
  id: string;
  date: string;
  competition?: string;
  homeTeam: {
    id: string;
    name: string;
    logo?: string;
    score: number;
  };
  awayTeam: {
    id: string;
    name: string;
    logo?: string;
    score: number;
  };
  winnerId?: string;
}

export interface TeamRecentForm {
  teamId: string;
  teamName: string;
  form: string;
  matches: Array<{
    id: string;
    date: string;
    opponentName: string;
    score: string;
    isHome: boolean;
    result: 'W' | 'D' | 'L';
  }>;
}

export interface DetailedMatchAnalysis {
  id: string;
  title: string;
  status: MatchStatus;
  statusText?: string;
  minute?: string;
  startTime: string;
  startTimestamp: number;
  league: MatchLeague;
  venue?: {
    name?: string;
    city?: string;
    attendance?: number;
  };
  referee?: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  boxscore: TeamBoxscore[];
  rosters: TeamRoster[];
  keyEvents: MatchKeyEvent[];
  odds?: MatchOdds;
  currentWinProbability?: {
    home: number;
    draw: number;
    away: number;
  };
  winProbabilityTimeline: WinProbabilityPoint[];
  recentForm: TeamRecentForm[];
  headToHead: HeadToHeadMatch[];
  commentary: MatchCommentaryItem[];
  broadcasts?: string[];
}

// ─── Phase 4 : Équipes & Joueurs ───
export interface PlayerStats {
  appearances?: number;
  subIns?: number;
  goals?: number;
  assists?: number;
  shots?: number;
  shotsOnTarget?: number;
  yellowCards?: number;
  redCards?: number;
  foulsCommitted?: number;
  foulsSuffered?: number;
  saves?: number;
  goalsConceded?: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  fullName?: string;
  displayName: string;
  shortName?: string;
  jersey?: string;
  position: {
    id?: string;
    name: string;
    displayName: string;
    abbreviation: string;
  };
  age?: number;
  dateOfBirth?: string;
  displayHeight?: string;
  displayWeight?: string;
  citizenship?: string;
  countryCode?: string;
  flag?: string;
  photo?: string;
  team?: {
    id: string;
    name: string;
    displayName: string;
    logo?: string;
  };
  statistics?: PlayerStats;
  statsSummary?: Array<{
    name: string;
    displayName: string;
    value: string | number;
  }>;
}

export interface TeamRosterGroup {
  position: string;
  players: PlayerProfile[];
}

export interface TeamDetails {
  id: string;
  name: string;
  displayName: string;
  shortDisplayName?: string;
  abbreviation?: string;
  location?: string;
  color?: string;
  alternateColor?: string;
  logo?: string;
  standingSummary?: string;
  venue?: {
    id?: string;
    name?: string;
    city?: string;
    capacity?: number;
  };
  record?: string;
}

export interface CompetitionLeader {
  rank: number;
  athlete: {
    id: string;
    displayName: string;
    shortName?: string;
    headshot?: string;
    jersey?: string;
    position?: string;
  };
  team?: {
    id: string;
    name: string;
    displayName: string;
    logo?: string;
  };
  value: number;
  displayValue: string;
}

export interface CompetitionLeadersCategory {
  name: string;
  displayName: string;
  leaders: CompetitionLeader[];
}
