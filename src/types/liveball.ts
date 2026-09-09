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
  type: "hls" | "iframe";
}