export interface LiveBallMatch {
  id: string;
  status: "live" | "upcoming";
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  score?: string;
  minute?: string;
  startTs?: number;
  league?: string;
}

export interface LiveBallStream {
  url: string;
  /** URL de notre relay HLS (renvoyée par le backend, absente du type historique). */
  relayUrl?: string;
  type: "hls" | "iframe";
}