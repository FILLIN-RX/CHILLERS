import {
  MatchTeam,
  MatchLeague,
  MatchStatus,
  TeamBoxscore,
  TeamRoster,
  MatchKeyEvent,
} from './matches.types';

export interface MatchOdds {
  provider?: string;
  details?: string;
  overUnder?: number;
  spread?: number;
  homeMoneyLine?: number;
  awayMoneyLine?: number;
  drawMoneyLine?: number;
  homeWinProbability?: number; // 0 à 100%
  drawProbability?: number;    // 0 à 100%
  awayWinProbability?: number;    // 0 à 100%
}

export interface WinProbabilityPoint {
  playId?: string;
  clock?: string;
  period?: number;
  homeWinPercentage: number; // 0 à 100
  tiePercentage: number;     // 0 à 100
  awayWinPercentage: number; // 0 à 100
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
  form: string; // Ex: 'W,W,D,L,W'
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
