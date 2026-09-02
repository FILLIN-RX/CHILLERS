// Discriminated union for download lifecycle. Each status carries its own payload
// so consumers (UI, store, retry logic) get exhaustive checks via `never`.

import type { Episode } from "./media";

export type DownloadStatus =
  | "queued"     // created, not yet started
  | "resolving"  // fetching the resolved URL from backend
  | "ready"      // URL resolved, not yet streamed to disk
  | "downloading"// bytes flowing to disk
  | "paused"     // user paused, can be resumed
  | "done"       // finished, file saved
  | "error"      // unrecoverable failure
  | "canceled";  // user canceled

export interface DownloadTask {
  /** Stable key (e.g. movie-${tmdbId} or series-${tmdbId}-S${s}E${e}) */
  id: string;
  /** TMDB id of the movie/series root. */
  tmdbId: string;
  /** Display title (movie title or series title for series). */
  title: string;
  /** Media type — "movie", "series" or "anime". */
  type: "movie" | "series" | "anime";
  /** Poster image URL for movies/series. */
  posterUrl?: string;
  /** Backdrop image URL for wide preview. */
  backdropUrl?: string;
  /** Filename suggested to the browser's save dialog. */
  filename: string;
  /** For series: the targeted episode (undefined for movies). */
  episode?: Episode;
  /** Season number for series. */
  season?: number;
  /** Episode number for series. */
  episodeNumber?: number;
  /** Resolved backend URL (after /api/doodstream/download). Null while resolving. */
  resolvedUrl: string | null;
  /** Bytes downloaded so far. */
  bytesDownloaded: number;
  /** Total bytes if known (Content-Length from upstream). */
  totalBytes: number | null;
  /** Lifecycle status — see DownloadStatus above. */
  status: DownloadStatus;
  /** Human-readable error message, when status === "error". */
  error?: string;
  /** Wall-clock timestamp when the task was created. */
  createdAt: number;
  /** Updated on every progress tick. */
  updatedAt: number;
}

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
  /** 0..100, derived from bytesDownloaded / totalBytes when total is known. */
  percent: number | null;
}

export interface DownloadResolutionResult {
  downloadUrl: string;
  fileCode: string;
}