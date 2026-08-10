// Types for the video player and continue-watching feature.

export interface ProgressEntry {
  id: string;
  title: string;
  type: "movie" | "series" | "anime" | "documentary";
  posterUrl: string;
  backdropUrl: string;
  episodeId?: string;
  season?: number;
  episode?: number;
  /** Position in seconds. */
  time: number;
  /** Total duration in seconds. */
  duration: number;
  /** 0..100. */
  progress: number;
  /** Pre-formatted display label, e.g. "5m left". */
  remaining: string;
  /** e.g. "S01E03". */
  episodeName?: string;
  /** Wall-clock timestamp of the last update. */
  updatedAt: number;
}

export interface PlayerQuality {
  /** "auto" picks hls.currentLevel = -1. */
  id: "auto" | "1080p" | "720p" | "480p";
  /** Pixel height used to match a level. */
  height?: number;
}