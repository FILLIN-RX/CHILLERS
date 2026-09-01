// Download service. Responsible for resolving the actual file URL from the backend,
// and (Phase 3) streaming bytes to disk with progress + AbortSignal.
//
// Currently thin wrappers around the existing backend endpoints — the streaming-to-disk
// logic lives in services/streamSaver.ts and is wired up in Phase 3.

import { httpJson, API_BASE_PATH, HttpError } from "./http";
import type { DownloadResolutionResult } from "@/types/download";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface DownloadResponse {
  downloadUrl: string;
  fileCode: string;
}

export async function resolveDownloadUrl(
  tmdbId: string | number,
  type: "movie" | "series" | "anime",
  title?: string,
  season?: number,
  episode?: number,
): Promise<DownloadResolutionResult | null> {
  const query: Record<string, string> = {};
  const tmdbStr = String(tmdbId);
  // tmdb_id is the most reliable resolver key; only forward it for numeric TMDB ids.
  if (tmdbStr && /^\d+$/.test(tmdbStr)) query.tmdb_id = tmdbStr;
  if (title) query.title = title;
  if (type) query.type = type;
  if (season !== undefined) query.season = String(season);
  if (episode !== undefined) query.episode = String(episode);

  if (!query.tmdb_id && !query.title) return null;

  try {
    const env = await httpJson<ApiEnvelope<DownloadResponse>>("/doodstream/download", {
      query,
      timeoutMs: 30_000,
    });
    if (env.success && env.data?.downloadUrl) {
      return { downloadUrl: env.data.downloadUrl, fileCode: env.data.fileCode };
    }
  } catch (err) {
    if (err instanceof HttpError) return null;
    console.error("Error starting download:", err);
  }
  return null;
}

interface SeriesDownloadCheckResponse {
  missing?: { season: number; episode: number }[];
  episodes?: { season: number; episode: number; fileCode: string; downloadUrl: string | null }[];
  total?: number;
  seriesTitle?: string | null;
}

export async function checkSeriesDownloads(tmdbId: string): Promise<
  | { ok: true; data: SeriesDownloadCheckResponse }
  | { ok: false; data?: SeriesDownloadCheckResponse; message?: string }
> {
  try {
    const env = await httpJson<ApiEnvelope<SeriesDownloadCheckResponse>>(
      "/doodstream/series/download-check",
      { query: { tmdb_id: tmdbId }, timeoutMs: 20_000 },
    );
    if (env.success && env.data) {
      return { ok: true, data: env.data };
    }
    return { ok: false, data: env.data, message: env.message ?? "Série incomplète ou indisponible" };
  } catch (err) {
    if (err instanceof HttpError) {
      return { ok: false, message: "Erreur lors de la vérification de la série" };
    }
    console.error("Error checking series downloads:", err);
    return { ok: false, message: "Erreur lors de la vérification de la série" };
  }
}

/* ─── legacy fire-and-forget triggers (kept for v1 modals) ──────────────── */

/** Returns an href to navigate to, suitable for an anchor click or window.open. */
export function proxyDownloadHref(downloadUrl: string, filename: string): string {
  if (downloadUrl.startsWith("/api/")) {
    return downloadUrl.startsWith(API_BASE_PATH) ? downloadUrl : `${API_BASE_PATH}${downloadUrl}`;
  }
  if (/doodstream\.com\/d\//i.test(downloadUrl)) return downloadUrl;
  return `${API_BASE_PATH}/doodstream/download/proxy?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`;
}

/**
 * Detects whether a URL should be opened in a new tab (DoodStream HTML page) or saved directly.
 */
export function isHtmlPageDownload(downloadUrl: string): boolean {
  return /doodstream\.com\/d\//i.test(downloadUrl);
}

/**
 * Verifies that a download URL actually streams bytes by issuing a Range: bytes=0-0 request.
 * Returns true if the server returned at least one byte before the abort fired.
 */
export async function verifyDownloadStarted(
  downloadUrl: string,
  filename = "video.mp4",
): Promise<boolean> {
  if (typeof window === "undefined") return true;
  if (isHtmlPageDownload(downloadUrl)) return true;

  const href = proxyDownloadHref(downloadUrl, filename);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(href, {
      headers: { Range: "bytes=0-0" },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = res.body;
    if (!body) return res.headers.get("content-length") !== "0";
    const reader = body.getReader();
    const { value, done } = await reader.read();
    reader.releaseLock();
    return !done && !!value && value.byteLength > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

/**
 * Résout le lien de téléchargement 1080p haute vitesse pour les membres Premium
 */
export function getPremiumDownloadUrl(title: string, filename?: string): string {
  const file = filename || `${title || 'film'}.mp4`;
  return `${API_BASE_PATH}/download/premium?title=${encodeURIComponent(title)}&filename=${encodeURIComponent(file)}`;
}