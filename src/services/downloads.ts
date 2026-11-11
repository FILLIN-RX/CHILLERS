// Download service. Responsible for resolving the actual file URL from the backend,
// and (Phase 3) streaming bytes to disk with progress + AbortSignal.
//
// Currently thin wrappers around the existing backend endpoints — the streaming-to-disk
// logic lives in services/streamSaver.ts and is wired up in Phase 3.

import { httpJson, API_BASE_PATH, HttpError, getBackendOrigin } from "./http";
import { getAntiBotHeaders } from "@/lib/antibot";
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
  language = "fr",
): Promise<DownloadResolutionResult | null> {
  const query: Record<string, string> = {};
  const tmdbStr = String(tmdbId);
  // tmdb_id is the most reliable resolver key; only forward it for numeric TMDB ids.
  if (tmdbStr && /^\d+$/.test(tmdbStr)) query.tmdb_id = tmdbStr;
  if (title) query.title = title;
  if (type) query.type = type;
  if (season !== undefined) query.season = String(season);
  if (episode !== undefined) query.episode = String(episode);
  if (language) query.language = language;
  if (typeof navigator !== "undefined" && /iPad|iPhone|iPod/i.test(navigator.userAgent)) {
    query.isIOS = "true";
  }

  if (!query.tmdb_id && !query.title) return null;

  try {
    // 1. Tente en priorité le résolveur universel multi-sources (MongoDB, OmniSave, FrenchStream, etc.)
    const env = await httpJson<ApiEnvelope<DownloadResponse>>("/download/resolve", {
      query,
      timeoutMs: 25_000,
    });
    if (env.success && env.data?.downloadUrl) {
      return { downloadUrl: env.data.downloadUrl, fileCode: env.data.fileCode || "" };
    }
  } catch (err) {
    // 2. Fallback sur le résolveur doodstream historique si nécessaire
    try {
      const fallback = await httpJson<ApiEnvelope<DownloadResponse>>("/doodstream/download", {
        query,
        timeoutMs: 20_000,
      });
      if (fallback.success && fallback.data?.downloadUrl) {
        return { downloadUrl: fallback.data.downloadUrl, fileCode: fallback.data.fileCode || "" };
      }
    } catch (_) {}
    if (err instanceof HttpError) return null;
    console.error("Error starting download:", err);
  }
  return null;
}

/**
 * Une signature d'hébergeur vaut quelques heures (Vidzy `e=14400` → 4 h).
 * `e` est soit une epoch UNIX, soit une durée en secondes à partir de `s`.
 * Au-delà, le CDN répond un 403 (page nginx) : on prévient le client avant
 * de lancer un téléchargement qui échouerait.
 */
export function isSignedLinkExpired(
  url: string | null | undefined,
  marginSeconds = 60,
): boolean {
  if (!url) return false;
  try {
    const u = new URL(url, "https://local.invalid");
    const eParam = u.searchParams.get("e");
    if (!eParam) return false;
    const exp = Number.parseInt(eParam, 10);
    if (!Number.isFinite(exp)) return false;

    let expirySec: number;
    if (exp >= 1_000_000_000) {
      expirySec = exp;
    } else {
      const s = Number.parseInt(u.searchParams.get("s") || "", 10);
      if (!Number.isFinite(s)) return false;
      expirySec = s + exp;
    }
    return Date.now() + marginSeconds * 1000 > expirySec * 1000;
  } catch {
    return false;
  }
}

/**
 * Le résolveur backend peut renvoyer la page d'un hébergeur quand aucun fichier
 * n'a pu en être extrait. Naviguer dessus ferait quitter l'app pour le site tiers.
 */
export function isDownloadableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.includes("/api/download/")) return true;
  return /\.(mp4|mkv|webm|m4v)(\?|$)/i.test(url);
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
  return `${API_BASE_PATH}/download/file?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`;
}

/**
 * Normalise une URL de téléchargement pour iOS : WebKit ignore l'attribut
 * `download` cross-origin et lit un MP4 inline tant que le serveur ne renvoie
 * pas `Content-Disposition: attachment`. Toute URL tierce (http direct) est
 * donc passée par le proxy /file (headers safari-safe). Les URLs /api/ déjà
 * proxifiées sont retournées telles quelles.
 *
 * À utiliser sur TOUS les points de téléchargement iOS (triggerAttachmentDownload,
 * ancre…) pour garantir la boîte native de téléchargement.
 */
export function toIOSDownloadHref(downloadUrl: string, filename: string): string {
  if (!downloadUrl) return downloadUrl;
  if (downloadUrl.startsWith("/api/") || downloadUrl.startsWith(API_BASE_PATH)) {
    return downloadUrl;
  }
  if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) {
    return `${getBackendOrigin()}/api/download/file?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename || "video.mp4")}`;
  }
  return downloadUrl;
}

/**
 * Ouvre la boîte de téléchargement Safari/iOS dans un nouvel onglet qui se ferme automatiquement.
 *
 * window.open() ouvre un onglet → le serveur répond Content-Disposition: attachment → 
 * Safari déclenche le téléchargement natif → l'onglet se ferme après 2s.
 * Le téléchargement continue en arrière-plan dans le gestionnaire de Safari.
 *
 * Ancienne approche (iframe cachée) ne fonctionnait plus de manière fiable sur iOS récents.
 * Appeler depuis un geste utilisateur (WebKit limite un fichier par geste).
 */
export function triggerAttachmentDownload(href: string): void {
  if (typeof window === "undefined" || !href) return;
  
  // Convert relative URLs to absolute backend URLs
  const absoluteHref = href.startsWith('http') ? href : `${getBackendOrigin()}${href}`;
  
  console.log('[download] triggerAttachmentDownload ->', absoluteHref);
  
  const win = window.open(absoluteHref, '_blank');
  if (win) {
    // Fermer l'onglet après 2s — le téléchargement Safari continue en arrière-plan
    setTimeout(() => {
      try {
        win.close();
      } catch (e) {
        console.warn('[download] could not close tab:', e);
      }
    }, 2000);
  } else {
    // Popup bloqué : fallback iframe (comportement dégradé)
    console.warn('[download] window.open blocked, falling back to iframe');
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden;';
    document.body.appendChild(frame);
    frame.src = absoluteHref;
    window.setTimeout(() => frame.remove(), 120_000);
  }
}

/**
 * Detects whether a URL should be opened in a new tab (deprecated: all downloads now stream directly).
 */
export function isHtmlPageDownload(_downloadUrl: string): boolean {
  return false;
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
      headers: {
        ...getAntiBotHeaders(),
        Range: "bytes=0-0",
      },
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