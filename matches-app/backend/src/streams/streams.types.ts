export interface StreamServer {
  id: string;
  name: string;
  url: string;
  type: 'hls' | 'iframe';
  quality?: string;
  isPrimary?: boolean;
}

export interface ResolvedStreamResponse {
  success: boolean;
  matchId: string;
  homeTeam?: string;
  awayTeam?: string;
  status: 'resolved' | 'not_found' | 'error';
  source?: string;
  sourceMatchId?: string;
  primaryUrl?: string;
  primaryType?: 'hls' | 'iframe';
  servers: StreamServer[];
  message?: string;
}

export interface LiveSourceMatch {
  id: string;
  status: 'live' | 'upcoming';
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  score?: string;
  minute?: string;
  startTs?: number;
  league?: string;
}
