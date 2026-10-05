import { MatchTeam } from '../matches/matches.types';

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
  // Gardien
  saves?: number;
  goalsConceded?: number;
  cleanSheets?: number;
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
  position: string; // 'Goalkeeper', 'Defender', 'Midfielder', 'Forward'
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
  roster?: TeamRosterGroup[];
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
