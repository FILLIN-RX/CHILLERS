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
  /** Sport rattaché : la page /matches filtre le football, la liste des ligues sert aussi la vitrine. */
  sport?: SportType;
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

/**
 * Affiche d'une rencontre telle que la subit le site : les sources live
 * (LiveBall, kora, …) publient le match et son flux mais rarement la
 * compétition ni des écussons fiables, alors que le service de score les a.
 * Cet index compact sert uniquement à rattacher une rencontre diffusée à sa
 * compétition officielle et à ses logos.
 */
export interface PosterFixture {
  id: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  leagueLogo: string;
  status: MatchStatus;
  /** Coupure d'envoi en secondes epoch, pour vérifier que la jointure est du même jour. */
  startTs: number;
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
