// Lightweight formatting helpers used across the app.

/** Format bytes as human-readable (e.g. 1.4 GB). */
export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format seconds as `H:MM:SS` or `M:SS`. */
export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Build a cross-platform filename for an episode. */
export function buildEpisodeFilename(opts: {
  title: string;
  season?: number;
  episodeNumber?: number;
  extension?: string;
}): string {
  const { title, season, episodeNumber, extension = "mp4" } = opts;
  const safeTitle = title.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (season != null && episodeNumber != null) {
    return `${safeTitle}_S${String(season).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}.${extension}`;
  }
  return `${safeTitle}.${extension}`;
}

/** Stable id for a download task derived from its media coordinates. */
export function downloadTaskId(opts: {
  tmdbId: string | number;
  season?: number;
  episodeNumber?: number;
}): string {
  const { tmdbId, season, episodeNumber } = opts;
  if (season != null && episodeNumber != null) {
    return `${tmdbId}-s${season}e${episodeNumber}`;
  }
  return `${tmdbId}`;
}