export type SportsSourceId = "liveball" | "kora" | "kooorah" | "yallapro" | "streamiz";

export interface SportsMatch {
  /** Identifiant composite `source:sourceId`, utilisé dans les URL. */
  id: string;
  /** Identifiant technique propre à la source (numéro, hash, URL). */
  sourceId: string;
  source: SportsSourceId;
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

export interface SportsServer {
  name: string;
  url: string;
  /** Type propre à ce miroir : une chaîne peut proposer les deux. */
  type?: "hls" | "iframe";
  /** Renseigné par le backend pour les miroirs HLS (à jouer via notre relay). */
  relayUrl?: string;
  /** Referer attendu par le lecteur (hôtes « domain protected »). */
  referer?: string;
}

export interface SportsStream {
  url: string;
  /** URL brute de la source, avant relay éventuel. */
  directUrl?: string;
  /** URL de notre relay HLS, uniquement si `type === "hls"`. */
  relayUrl?: string;
  type: "hls" | "iframe";
  /** Referer attendu par le lecteur (hôtes « domain protected »). */
  referer?: string;
  /** Source qui sert effectivement le flux : pas forcément celle du match affiché. */
  provider?: SportsSourceId;
  servers: SportsServer[];
  match?: SportsMatch;
}
