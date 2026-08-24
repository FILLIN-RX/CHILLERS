// Admin endpoints. Same call shape as the legacy api.ts adminFetch wrapper but
// routed through services/http.ts so timeouts/abort/errors are uniform.

import { httpJson, API_BASE_PATH } from "./http";
import type { LiveChannel, LiveChannelInput } from "@/types/live";

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("admin-token");
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AdminEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function adminRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const headers = { Accept: "application/json", ...authHeaders() };
  return httpJson<T>(`/admin${path}`, {
    method: options.method ?? "GET",
    body: options.body,
    headers,
    timeoutMs: options.timeoutMs,
  });
}

/* Auth */

export async function adminLogin(username: string, password: string): Promise<AdminEnvelope<{ token: string }>> {
  // Login has its own unauth path and stores the token on success.
  const res = await httpJson<AdminEnvelope<{ token: string }>>("/admin/auth/login", {
    method: "POST",
    body: { username, password },
    timeoutMs: 15_000,
  });
  if (res.success && res.data?.token) {
    try {
      localStorage.setItem("admin-token", res.data.token);
    } catch {
      /* storage disabled */
    }
  }
  return res;
}

export async function adminVerify(): Promise<AdminEnvelope<unknown>> {
  try {
    return await adminRequest<AdminEnvelope<unknown>>("/auth/verify");
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.includes("401")) {
      return { success: false, message: "Non authentifié" };
    }
    throw err;
  }
}

export function adminLogout(): void {
  try {
    localStorage.removeItem("admin-token");
  } catch {
    /* ignore */
  }
}

/* Dashboard / logs / settings */

export const adminGetDashboard = () => adminRequest<AdminEnvelope<unknown>>("/dashboard");
export const adminGetLogs = (type = "all", lines = 100) =>
  adminRequest<AdminEnvelope<unknown>>(`/logs?type=${type}&lines=${lines}`);

export const adminGetDeadLinks = () => adminRequest<AdminEnvelope<unknown>>("/dead-links");
export const adminAppealDeadLink = (id: string) =>
  adminRequest<AdminEnvelope<unknown>>(`/dead-links/appeal/${id}`, { method: "POST" });

export const adminGetSettings = () => adminRequest<AdminEnvelope<unknown>>("/settings");
export const adminUpdateSettings = (settings: Record<string, string>) =>
  adminRequest<AdminEnvelope<unknown>>("/settings", { method: "PUT", body: settings });

export const adminTriggerScrape = (type: string) =>
  adminRequest<AdminEnvelope<{ status?: string; message?: string }>>(
    "/scrape/trigger",
    { method: "POST", body: { type } },
  );

export const adminClearCache = () =>
  adminRequest<AdminEnvelope<unknown>>("/clear-cache", { method: "POST" });

interface LiensPaginated {
  items: unknown[];
  total: number;
  totalPages: number;
  page: number;
}

export const adminGetConvertedLinks = (q = "", page = 1, limit = 50) =>
  adminRequest<AdminEnvelope<LiensPaginated>>(
    `/collection/links?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
  );

/**
 * Generic collection fetch — the shape of `items` is left `unknown` because the
 * admin movies/series pages each carry their own `Movie` / `Serie` row types.
 * Pages cast `res.data.items` to their local type at the call site.
 */
export const adminGetCollection = (type: string, q = "", page = 1, limit = 50) =>
  adminRequest<AdminEnvelope<Record<string, unknown>>>(
    `/collection?type=${type}&q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
  );

export const adminGetScraperState = () => adminRequest<AdminEnvelope<unknown>>("/scraper-state");

export const adminGetSerie = (id: string) => adminRequest<AdminEnvelope<unknown>>(`/serie/${id}`);

export const adminGetMovie = (id: string) => adminRequest<AdminEnvelope<unknown>>(`/movie/${id}`);

export const adminGetTmdbStats = () => adminRequest<AdminEnvelope<unknown>>("/tmdb/stats");

export const adminTriggerTmdbLink = (type: string) =>
  adminRequest<AdminEnvelope<{ status?: string; message?: string }>>("/tmdb/link", {
    method: "POST",
    body: { type },
  });

/* Cron */

export const adminCronStart = () => adminRequest<AdminEnvelope<unknown>>("/cron/start", { method: "POST" });
export const adminCronStop = () => adminRequest<AdminEnvelope<unknown>>("/cron/stop", { method: "POST" });
export const adminCronStatus = () => adminRequest<AdminEnvelope<unknown>>("/cron/status");

export const adminRunMaintenance = (type: string) =>
  adminRequest<AdminEnvelope<unknown>>("/maintenance/run", { method: "POST", body: { type } });

export const adminGetRunningTasks = () => adminRequest<AdminEnvelope<unknown>>("/tasks/running");
export const adminStopTask = (name: string) =>
  adminRequest<AdminEnvelope<unknown>>(`/tasks/stop/${encodeURIComponent(name)}`, { method: "POST" });
export const adminRunTask = (taskId: string) =>
  adminRequest<AdminEnvelope<unknown>>(`/cron/run/${encodeURIComponent(taskId)}`, { method: "POST" });
export const adminListProcesses = () => adminRequest<AdminEnvelope<unknown>>("/cron/processes");
export const adminKillProcess = (pid: number) =>
  adminRequest<AdminEnvelope<unknown>>(`/cron/kill/${pid}`, { method: "POST" });
export const adminGetSystemCron = () => adminRequest<AdminEnvelope<unknown>>("/cron/system");

export function adminGetLogsStreamUrl(): string {
  const token = getAdminToken();
  return `${API_BASE_PATH}/admin/logs/stream?token=${token ?? ""}`;
}

/* Uqload */

export const adminUqloadStatus = () => adminRequest<AdminEnvelope<unknown>>("/uqload/status");
export const adminUqloadPending = () => adminRequest<AdminEnvelope<unknown>>("/uqload/pending");
export const adminUqloadUploadMovies = () =>
  adminRequest<AdminEnvelope<unknown>>("/uqload/upload/movies", { method: "POST" });
export const adminUqloadUploadSeries = () =>
  adminRequest<AdminEnvelope<unknown>>("/uqload/upload/series", { method: "POST" });
export const adminUqloadUploadMovie = (id: string) =>
  adminRequest<AdminEnvelope<unknown>>(`/uqload/upload/movie/${id}`, { method: "POST" });
export const adminUqloadUploadEpisode = (serieId: string, episodeIndex: number) =>
  adminRequest<AdminEnvelope<unknown>>(`/uqload/upload/serie/${serieId}/episode/${episodeIndex}`, {
    method: "POST",
  });
export const adminUqloadStop = () =>
  adminRequest<AdminEnvelope<unknown>>("/uqload/stop", { method: "POST" });
export const adminUqloadPendingBoth = () =>
  adminRequest<AdminEnvelope<unknown>>("/uqload/pending-both");
export const adminUqloadFiles = (params: {
  type?: "movies" | "series" | "all";
  page?: number;
  limit?: number;
  search?: string;
} = {}) => {
  const q = new URLSearchParams();
  if (params.type)   q.set("type",   params.type);
  if (params.page)   q.set("page",   String(params.page));
  if (params.limit)  q.set("limit",  String(params.limit));
  if (params.search) q.set("search", params.search);
  return adminRequest<AdminEnvelope<unknown>>(`/uqload/files?${q.toString()}`);
};

/** Infos temps réel d'un fichier Uqload (vues, durée, statut, miniature…) */
export const adminUqloadFileInfo = (code: string) =>
  adminRequest<AdminEnvelope<{
    code: string; title: string; views: number; duration: string;
    createdAt: string; public: boolean; canPlay: boolean;
    status: number; thumbnail: string; tags: string | null; embedUrl: string;
  }>>(`/uqload/file-info/${encodeURIComponent(code)}`);


/* Dead links / TMDB linking */

export const adminUpdateDeadLink = (id: string, lien: string) =>
  adminRequest<AdminEnvelope<unknown>>(`/dead-links/${id}`, { method: "PUT", body: { lien } });

export const adminRescrapeDeadLink = (id: string, headless = true) =>
  adminRequest<AdminEnvelope<unknown>>(`/dead-links/rescrape/${id}`, {
    method: "POST",
    body: { headless },
  });

export const adminLinkTmdb = (type: "movies" | "series", id: string, tmdbId: number) =>
  adminRequest<AdminEnvelope<unknown>>("/collection/link-tmdb", {
    method: "POST",
    body: { type, id, tmdbId },
  });

import type { TmdbSearchResult } from "@/types/admin";

export const adminTmdbSearch = (query: string, type: "movie" | "tv", year?: number) => {
  const params = new URLSearchParams({ query, type });
  if (year) params.set("year", String(year));
  return adminRequest<AdminEnvelope<TmdbSearchResult[]>>(`/media/tmdb-search?${params.toString()}`);
};

export const adminCreateManualMedia = (payload: {
  type: "movie" | "serie";
  titre: string;
  lien?: string;
  tmdbId: number;
  year?: number;
  episodes?: { season: number; episodeNumber: number; lien: string; episode?: string }[];
}) =>
  adminRequest<AdminEnvelope<unknown>>("/media/manual", { method: "POST", body: payload });

export async function adminCreateManualMediaUpload(formData: FormData): Promise<AdminEnvelope<unknown>> {
  // Bypass JSON content-type; use FormData multipart with the admin token manually.
  const token = getAdminToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60_000);
  try {
    const res = await fetch(`${API_BASE_PATH}/admin/media/manual/upload`, {
      method: "POST",
      body: formData,
      headers,
      signal: controller.signal,
    });
    return (await res.json()) as AdminEnvelope<unknown>;
  } finally {
    clearTimeout(timer);
  }
}

/* Scrapper distant */

interface ScrapperHealth { status: string; uptime: number; db: string }
interface ScrapperSettings { port: string; mongoUri: string; tmdbToken: string; cronRunning: boolean }
interface ScrapperState { films: { lastPage: number; updatedAt: string } | null; series: { lastPage: number; updatedAt: string } | null }
interface ScrapperCronStatus { running: boolean }
interface ScrapperRunningTasks { tasks: string[] }

export const adminScrapperHealth = () =>
  adminRequest<AdminEnvelope<ScrapperHealth>>("/scrapper/health");
export const adminScrapperSettings = () =>
  adminRequest<AdminEnvelope<ScrapperSettings>>("/scrapper/settings");
export const adminScrapperLogs = (lines = 200) =>
  adminRequest<AdminEnvelope<unknown>>(`/scrapper/logs?lines=${lines}`);
export const adminScrapperRunningTasks = () =>
  adminRequest<AdminEnvelope<ScrapperRunningTasks>>("/scrapper/tasks/running");
export const adminScrapperCronStatus = () =>
  adminRequest<AdminEnvelope<ScrapperCronStatus>>("/scrapper/cron/status");
export const adminScrapperState = () =>
  adminRequest<AdminEnvelope<ScrapperState>>("/scrapper/scraper-state");

export function adminScrapperLogsStreamUrl(): string {
  const token = getAdminToken();
  return `${API_BASE_PATH}/admin/scrapper/logs/stream?token=${token ?? ""}`;
}

export const adminScrapperTriggerScrape = (type: string) =>
  adminRequest<AdminEnvelope<unknown>>("/scrapper/scrape/trigger", { method: "POST", body: { type } });
export const adminScrapperRunMaintenance = (type: string) =>
  adminRequest<AdminEnvelope<unknown>>("/scrapper/maintenance/run", { method: "POST", body: { type } });
export const adminScrapperStopTask = (name: string) =>
  adminRequest<AdminEnvelope<unknown>>(`/scrapper/tasks/stop/${encodeURIComponent(name)}`, {
    method: "POST",
  });
export const adminScrapperCronStart = () =>
  adminRequest<AdminEnvelope<unknown>>("/scrapper/cron/start", { method: "POST" });
export const adminScrapperCronStop = () =>
  adminRequest<AdminEnvelope<unknown>>("/scrapper/cron/stop", { method: "POST" });

/* Affiches & Disponibilité */

export interface AfficheItem {
  _id: string;
  titre: string;
  year?: number;
  tmdbId?: number;
  posterUrl?: string;
  posterSource?: string;
  speech?: string | null;
  disponible?: boolean | null;
  disponibleCheckedAt?: string | null;
  mediaType: "movie" | "series";
  link: string | null;
}

export async function adminAffichesList(params: {
  type?: "all" | "movie" | "series";
  disponible?: boolean;
  source?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params.type && params.type !== "all") query.set("type", params.type);
  if (params.disponible !== undefined) query.set("disponible", String(params.disponible));
  if (params.source) query.set("source", params.source);
  if (params.q) query.set("q", params.q);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  return adminRequest<AdminEnvelope<{ items: AfficheItem[]; total: number }>>(
    `/affiches?${query.toString()}`,
  );
}

export const adminAffichesGenerate = (payload: { type?: string; id?: string }) =>
  adminRequest<AdminEnvelope<unknown>>("/affiches/generate", { method: "POST", body: payload });
export const adminAffichesStatus = () => adminRequest<AdminEnvelope<unknown>>("/affiches/status");
export const adminAvailabilityScan = (type: "all" | "movie" | "series") =>
  adminRequest<AdminEnvelope<unknown>>("/availability/scan", {
    method: "POST",
    body: { type },
  });
export const adminAvailabilityStatus = () => adminRequest<AdminEnvelope<unknown>>("/availability/status");

export function adminAffichesPosterUrl(id: string, type: "movie" | "series"): string {
  return `${API_BASE_PATH}/affiches/${id}/poster?type=${type}`;
}
export function adminAffichesCardUrl(id: string, type: "movie" | "series"): string {
  return `${API_BASE_PATH}/affiches/${id}/card?type=${type}`;
}

/* Live TV (module isolé — routes sous /api/live, JWT admin) */

async function liveAdminRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const headers = { Accept: "application/json", ...authHeaders() };
  return httpJson<T>(`/live${path}`, {
    method: options.method ?? "GET",
    body: options.body,
    headers,
    timeoutMs: options.timeoutMs ?? 120_000,
  });
}

export const adminLiveList = () => liveAdminRequest<AdminEnvelope<LiveChannel[]>>("/admin/all");
export const adminLiveSync = (updateStreams = false) =>
  liveAdminRequest<AdminEnvelope<{ added: number; updated: number }>>("/sync", {
    method: "POST",
    body: { updateStreams },
  });
export const adminLiveCreate = (data: LiveChannelInput) =>
  liveAdminRequest<AdminEnvelope<LiveChannel>>("/", { method: "POST", body: data });
export const adminLiveUpdate = (id: string, data: LiveChannelInput) =>
  liveAdminRequest<AdminEnvelope<LiveChannel>>(`/${id}`, { method: "PUT", body: data });
export const adminLiveDelete = (id: string) =>
  liveAdminRequest<AdminEnvelope<{ deleted: boolean }>>(`/${id}`, { method: "DELETE" });

/* Assistant IA Marketing & Contenu */

export interface SocialSuggestionItem {
  platform: string;
  mediaTitle: string;
  mediaType: "movie" | "series";
  tmdbId?: number;
  hook: string;
  caption: string;
  chillersLink: string;
}

export interface ContentGapItem {
  tmdbId: number;
  title: string;
  type: "movie" | "series";
  overview?: string;
  releaseDate?: string;
  voteAverage?: number;
  posterPath?: string;
  reason: string;
}

export async function adminAiSocialSuggestions() {
  return adminRequest<AdminEnvelope<{ suggestions: SocialSuggestionItem[]; usedProvider: "gemini" | "groq" }>>(
    "/ai/social-suggestions",
    { method: "POST", timeoutMs: 45_000 }
  );
}

export async function adminAiContentGap() {
  return adminRequest<AdminEnvelope<{ items: ContentGapItem[]; usedProvider: "gemini" | "groq" }>>(
    "/ai/content-gap",
    { method: "GET", timeoutMs: 45_000 }
  );
}