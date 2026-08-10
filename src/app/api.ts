// Legacy compatibility layer.
//
// This file used to be the entire backend client (1200+ lines). It is now a thin
// re-export of the services split into src/services/*.ts. New code should import
// directly from the services modules. This file will be deleted in Phase 7 of
// the architecture refactor.

/* Public API of the services (re-exported so existing imports keep working). */

export {
  // http primitives
  httpJson,
  HttpError,
  resolveImageUrl,
  API_BASE_PATH,
} from "@/services/http";

export {
  // media
  getTrendingMovies,
  getTrendingTV,
  getPopularMovies,
  getPopularTV,
  getTopRatedTV,
  getAnimeSeries,
  getUpcomingMovies,
  getTopRatedMovies,
  getMediaDetails,
  getSeasonDetails,
  getMovieRecommendations,
  getRecommendedForYou,
  searchMedia,
  getStreamUrl,
  getNexStreamUrl,
  getMovieGenres,
  getTVGenres,
  getAllMovies,
  getPopularMoviesPage,
  getPopularTVPage,
  getAnimeSeriesPage,
  getMoviesByGenrePage,
  getTVByGenrePage,
  getMoviesByGenre,
  getMoviesByGenreMultiPage,
  getByGenreMultiple,
  getDisponible,
  clearTmdbCache,
  mapTMDBToMovieOrShow,
} from "@/services/media";

export type { TmdbRawItem } from "@/services/media";

export {
  // downloads
  resolveDownloadUrl,
  checkSeriesDownloads,
  verifyDownloadStarted,
  proxyDownloadHref,
  isHtmlPageDownload,
  // legacy alias kept for v1 modals
  resolveDownloadUrl as startDownload,
} from "@/services/downloads";

export {
  // progress (continue watching)
  loadProgress,
  saveProgress,
  clearProgress,
  listRecentProgress,
  pushProgressToBackend,
  progressKey,
} from "@/services/progress";

/* Admin endpoints: pass-through. Existing admin/* pages already use them. */
export {
  // auth
  adminLogin,
  adminVerify,
  adminLogout,
  // dashboard/logs/settings
  adminGetDashboard,
  adminGetLogs,
  adminGetDeadLinks,
  adminAppealDeadLink,
  adminGetSettings,
  adminUpdateSettings,
  adminTriggerScrape,
  adminClearCache,
  adminGetCollection,
  adminGetConvertedLinks,
  adminGetScraperState,
  adminGetSerie,
  adminGetTmdbStats,
  adminTriggerTmdbLink,
  // cron
  adminCronStart,
  adminCronStop,
  adminCronStatus,
  adminRunMaintenance,
  adminGetRunningTasks,
  adminStopTask,
  adminRunTask,
  adminListProcesses,
  adminKillProcess,
  adminGetSystemCron,
  adminGetLogsStreamUrl,
  // uqload
  adminUqloadStatus,
  adminUqloadPending,
  adminUqloadUploadMovies,
  adminUqloadUploadSeries,
  adminUqloadUploadMovie,
  adminUqloadUploadEpisode,
  adminUqloadStop,
  adminUqloadPendingBoth,
  // dead links / tmdb linking
  adminUpdateDeadLink,
  adminRescrapeDeadLink,
  adminLinkTmdb,
  adminTmdbSearch,
  adminCreateManualMedia,
  adminCreateManualMediaUpload,
  // scrapper distant
  adminScrapperHealth,
  adminScrapperSettings,
  adminScrapperLogs,
  adminScrapperRunningTasks,
  adminScrapperCronStatus,
  adminScrapperState,
  adminScrapperLogsStreamUrl,
  adminScrapperTriggerScrape,
  adminScrapperRunMaintenance,
  adminScrapperStopTask,
  adminScrapperCronStart,
  adminScrapperCronStop,
  // affiches / dispo
  adminAffichesList,
  adminAffichesGenerate,
  adminAffichesStatus,
  adminAvailabilityScan,
  adminAvailabilityStatus,
  adminAffichesPosterUrl,
  adminAffichesCardUrl,
} from "@/services/admin";

export type { AfficheItem, AdminEnvelope } from "@/services/admin";

/* Legacy helpers kept verbatim so we don't break existing call sites. */

import { proxyDownloadHref, isHtmlPageDownload } from "@/services/downloads";

/**
 * Triggers a browser download by appending an anchor to the DOM and clicking it.
 * This is the legacy fire-and-forget path used by the v1 modals. Phase 3
 * introduces useDownload() / useDownloadsBatch() which replace this with
 * a controlled StreamSaver + progress store flow.
 */
export function triggerDownload(downloadUrl: string, filename = "video.mp4"): void {
  if (typeof window === "undefined") return;

  if (isHtmlPageDownload(downloadUrl)) {
    window.open(downloadUrl, "_blank");
    return;
  }

  const href = proxyDownloadHref(downloadUrl, filename);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* Re-export the Genre type (was previously declared inline in api.ts). */
export type { Genre } from "@/types/media";