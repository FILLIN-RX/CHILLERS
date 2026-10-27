import type { OhaCategory } from "./oha";

export type EpgSource = "epgshare" | "oha" | "mixed" | "none";

export interface EpgProgram {
  title: string;
  subTitle?: string;
  description?: string;
  category?: string;
  icon?: string;
  episode?: string;
  /** ISO 8601 UTC */
  start: string;
  /** ISO 8601 UTC */
  end: string;
  source: "epgshare" | "oha";
}

export interface EpgGuideChannel {
  channelKey: string;
  /** Identifiant oha.to, utilisable avec /api/live/oha/resolve */
  id: string;
  altIds: string[];
  name: string;
  slug: string;
  logo: string | null;
  category: OhaCategory;
  tvg?: string;
  programs: EpgProgram[];
  now?: EpgProgram;
  next?: EpgProgram;
  source: EpgSource;
  updatedAt?: string;
  stale: boolean;
  hasFullGuide: boolean;
}

export interface EpgGuideCoverage {
  total: number;
  withNow: number;
  withFullGuide: number;
  epgshare: number;
  oha: number;
  none: number;
}

export interface EpgGuide {
  from: string;
  to: string;
  generatedAt: string;
  channels: EpgGuideChannel[];
  coverage: EpgGuideCoverage;
}
