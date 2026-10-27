export interface StreamServer {
  id: string;
  name: string;
  url: string;
  type: 'hls' | 'iframe';
  quality?: string;
  isPrimary?: boolean;
  /**
   * Relay HLS géré par le backend matches-app (`/api/sports/...`) : playlists
   * et segments passent par notre serveur (referer + IP stables), le CDN
   * distant ne voit que le backend. Le frontend le privilégie si présent.
   */
  relayUrl?: string;
  /** Source qui sert ce serveur (kora, kooorah, ...). */
  provider?: string;
  referer?: string;
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
