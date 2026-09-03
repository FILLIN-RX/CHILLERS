"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconDownload,
  IconCheck,
  IconAlertTriangle,
  IconPlayerPlay,
  IconPlayerPause,
  IconTrash,
  IconRefresh,
  IconMovie,
  IconSearch,
  IconX,
  IconDeviceTv,
  IconFolderOpen,
  IconWifiOff,
  IconWifi,
} from "@tabler/icons-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { streamDownloadToDisk } from "@/services/streamSaver";
import { streamVideoToIndexedDB, getStorageQuota, type StorageQuotaInfo } from "@/services/offlineStorage";
import { useDownloadsStore } from "@/store/downloads";
import DownloadProgressBar from "@/features/downloads/DownloadProgressBar";
import OfflinePlayerModal from "@/features/downloads/OfflinePlayerModal";
import type { DownloadTask } from "@/types/download";
import { formatBytes } from "@/lib/format";
import { resolveDownloadUrl, proxyDownloadHref } from "@/services/downloads";
import { useAuthStore } from "@/stores/useAuthStore";

function getPosterUrl(task: DownloadTask): string | null {
  const url = task.posterUrl || task.backdropUrl || task.episode?.thumbnail;
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `https://image.tmdb.org/t/p/w500${url}`;
  return `https://image.tmdb.org/t/p/w500/${url}`;
}

export default function DownloadsView({
  isEmbeddedInProfile = false,
}: {
  isEmbeddedInProfile?: boolean;
}) {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [filter, setFilter] = useState<"all" | "running" | "done" | "error">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [offlinePlayerTask, setOfflinePlayerTask] = useState<DownloadTask | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<StorageQuotaInfo | null>(null);

  const tasks = useDownloadsStore((s) => s.tasks);
  const removeTask = useDownloadsStore((s) => s.remove);
  const clearAll = useDownloadsStore((s) => s.clear);
  const setStatus = useDownloadsStore((s) => s.setStatus);
  const setProgress = useDownloadsStore((s) => s.setProgress);
  const updateTask = useDownloadsStore((s) => s.update);
  const requestCancel = useDownloadsStore((s) => s.requestCancel);
  const isCancelRequested = useDownloadsStore((s) => s.isCancelRequested);
  const getController = useDownloadsStore((s) => s.getController);
  const setController = useDownloadsStore((s) => s.setController);
  const removeController = useDownloadsStore((s) => s.removeController);
  const resetTasks = useDownloadsStore((s) => s.resetTasks);

  useEffect(() => {
    getStorageQuota().then((q) => {
      if (q) setQuotaInfo(q);
    });
  }, [tasks]);

  // Groupes de statuts
  const doneTasks = tasks.filter((t) => t.status === "done");
  const runningTasks = tasks.filter(
    (t) => t.status === "downloading" || t.status === "resolving" || t.status === "queued"
  );
  const pausedTasks = tasks.filter((t) => t.status === "paused");
  const errorTasks = tasks.filter((t) => t.status === "error" || t.status === "canceled");

  // Métriques
  const totalBytesDone = doneTasks.reduce(
    (acc, t) => acc + (t.totalBytes || t.bytesDownloaded || 0),
    0
  );

  // Filtrage
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "running") {
        if (!(t.status === "downloading" || t.status === "resolving" || t.status === "queued"))
          return false;
      } else if (filter === "done") {
        if (t.status !== "done") return false;
      } else if (filter === "error") {
        if (!(t.status === "error" || t.status === "canceled")) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesFilename = t.filename.toLowerCase().includes(q);
        if (!matchesTitle && !matchesFilename) return false;
      }

      return true;
    });
  }, [tasks, filter, searchQuery]);

  // Actions
  const handleCancelOne = (id: string) => {
    requestCancel(id);
    const ctrl = getController(id);
    ctrl?.abort();
    removeController(id);
    setStatus(id, "canceled");
  };

  const handlePauseOne = (id: string) => {
    const ctrl = getController(id);
    ctrl?.abort();
    removeController(id);
    setStatus(id, "paused");
  };

  const { user } = useAuthStore();
  const isSubscriber =
    user?.role === "admin" ||
    (user?.subscription?.status === "active" &&
      (user.subscription.plan === "standard" || user.subscription.plan === "premium"));

  const startStreamForTask = async (taskToRun: DownloadTask, url: string, ctrl: AbortController) => {
    if (isSubscriber) {
      await streamDownloadToDisk(url, {
        filename: taskToRun.filename,
        signal: ctrl.signal,
        saveBlob: false,
        onProgress: (bytes, total) => {
          setProgress(taskToRun.id, {
            bytesDownloaded: bytes,
            totalBytes: total,
            percent: total && total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null,
          });
        },
      });
    } else {
      await streamVideoToIndexedDB(url, {
        id: taskToRun.id,
        filename: taskToRun.filename,
        title: taskToRun.title,
        signal: ctrl.signal,
        onProgress: (bytes, total) => {
          setProgress(taskToRun.id, {
            bytesDownloaded: bytes,
            totalBytes: total,
            percent: total && total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null,
          });
        },
      });
    }
  };

  const handleResumeOne = async (targetTask: DownloadTask) => {
    let activeUrl = targetTask.resolvedUrl;
    const isUrlFresh =
      activeUrl &&
      targetTask.resolvedUrlAt &&
      Date.now() - targetTask.resolvedUrlAt < 6 * 60 * 60 * 1000;

    const ctrl = new AbortController();
    setController(targetTask.id, ctrl);

    try {
      if (!activeUrl || !isUrlFresh) {
        setStatus(targetTask.id, "resolving");
        const res = await resolveDownloadUrl(
          targetTask.tmdbId,
          targetTask.type,
          targetTask.title,
          targetTask.season,
          targetTask.episodeNumber
        );
        if (!res?.downloadUrl) {
          throw new Error("Impossible de résoudre le lien de téléchargement");
        }
        activeUrl = res.downloadUrl;
        updateTask(targetTask.id, {
          resolvedUrl: activeUrl,
          resolvedUrlAt: Date.now(),
        });
      }

      setStatus(targetTask.id, "downloading");
      await startStreamForTask(targetTask, activeUrl, ctrl);

      if (ctrl.signal.aborted || isCancelRequested(targetTask.id)) {
        setStatus(targetTask.id, "canceled");
      } else {
        setStatus(targetTask.id, "done");
      }
    } catch (err) {
      if (ctrl.signal.aborted || isCancelRequested(targetTask.id)) {
        setStatus(targetTask.id, "paused");
      } else {
        const msg = err instanceof Error ? err.message : "Erreur de reprise";
        setStatus(targetTask.id, "error", msg);
      }
    } finally {
      removeController(targetTask.id);
    }
  };

  const handleRetryOne = async (id: string) => {
    const targetTask = tasks.find((t) => t.id === id);
    if (!targetTask) return;
    resetTasks([id]);
    await handleResumeOne(targetTask);
  };

  const handleDeleteOne = (id: string) => {
    handleCancelOne(id);
    removeTask(id);
    setDeleteConfirmId(null);
  };

  const handleClearFinished = () => {
    doneTasks.forEach((t) => removeTask(t.id));
  };

  const handleClearAll = () => {
    tasks.forEach((t) => {
      const ctrl = getController(t.id);
      ctrl?.abort();
      removeController(t.id);
    });
    clearAll();
    setShowClearAllModal(false);
  };

  const handleRelaunchErrors = () => {
    const errorIds = errorTasks.map((t) => t.id);
    if (errorIds.length > 0) resetTasks(errorIds);
  };

  const handleWatch = (task: DownloadTask) => {
    // Si hors-ligne ou vidéo terminée -> Lancer le lecteur hors-ligne direct
    if ((typeof navigator !== "undefined" && !navigator.onLine) || task.status === "done") {
      setOfflinePlayerTask(task);
      return;
    }

    if (task.type === "series" || task.type === "anime") {
      const season = task.season || 1;
      const ep = task.episodeNumber || 1;
      router.push(`/tv/${task.tmdbId || task.id}/season/${season}?ep=${ep}`);
    } else {
      router.push(`/watch/${task.tmdbId || task.id}?type=movie`);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. EN-TÊTE DE LA PAGE */}
      {!isEmbeddedInProfile && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Connecté
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
                  <IconWifiOff className="w-3 h-3 text-red-400" />
                  Mode Hors-Ligne
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Téléchargements
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              {isOnline
                ? "Films et séries disponibles pour visionnage sans connexion"
                : "Vous êtes hors-ligne. Vous pouvez regarder vos vidéos téléchargées."}
            </p>
          </div>

          {/* Stats Pills */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-zinc-900/80 border border-white/5 px-3 py-1.5 rounded-full text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-white">{doneTasks.length} prêts</span>
              </div>

              {runningTasks.length > 0 && (
                <div className="flex items-center gap-2 bg-zinc-900/80 border border-white/5 px-3 py-1.5 rounded-full text-xs">
                  <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                  <span className="font-semibold text-white">
                    {runningTasks.length} en cours
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 bg-zinc-900/80 border border-white/5 px-3 py-1.5 rounded-full text-xs text-zinc-400">
                <span>Téléchargements :</span>
                <span className="font-semibold text-white">{formatBytes(totalBytesDone)}</span>
              </div>

              {quotaInfo && quotaInfo.quotaBytes > 0 && (
                <div className="flex items-center gap-2 bg-zinc-900/80 border border-white/5 px-3 py-1.5 rounded-full text-xs text-zinc-400" title={`Espace appareil total alloué: ${formatBytes(quotaInfo.quotaBytes)}`}>
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Dispo appareil :</span>
                  <span className="font-semibold text-cyan-300">{formatBytes(quotaInfo.availableBytes)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. FILTRES & BARRE D'ACTIONS */}
      {tasks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs Filtres */}
          <div className="inline-flex bg-zinc-900/80 p-1 rounded-xl border border-white/5 overflow-x-auto">
            <button
              onClick={() => setFilter("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filter === "all"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Tous ({tasks.length})
            </button>
            <button
              onClick={() => setFilter("done")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filter === "done"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Prêts ({doneTasks.length})
            </button>
            <button
              onClick={() => setFilter("running")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filter === "running"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              En cours ({runningTasks.length})
            </button>
            {errorTasks.length > 0 && (
              <button
                onClick={() => setFilter("error")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  filter === "error"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Erreurs ({errorTasks.length})
              </button>
            )}
          </div>

          {/* Recherche & Nettoyage */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <IconSearch className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/80 border border-white/5 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {doneTasks.length > 0 && (
              <button
                onClick={handleClearFinished}
                className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 text-zinc-300 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                Nettoyer
              </button>
            )}

            <button
              onClick={() => setShowClearAllModal(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 text-red-400 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Tout effacer
            </button>
          </div>
        </div>
      )}

      {/* 3. GRILLE DES TÉLÉCHARGEMENTS */}
      {filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const isPaused = task.status === "paused";
            const isRunning =
              task.status === "downloading" ||
              task.status === "resolving" ||
              task.status === "queued";
            const isDone = task.status === "done";
            const isError = task.status === "error" || task.status === "canceled";
            const subtitle =
              task.episodeNumber != null
                ? `Saison ${task.season ?? 1} · Épisode ${task.episodeNumber}`
                : null;
            const poster = getPosterUrl(task);

            return (
              <div
                key={task.id}
                className="bg-zinc-900/50 hover:bg-zinc-900/80 border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-lg hover:shadow-2xl"
              >
                <div>
                  {/* YouTube style 16:9 Thumbnail with Overlay badges */}
                  <div
                    onClick={() => isDone && handleWatch(task)}
                    className={`relative aspect-video w-full overflow-hidden bg-zinc-950 ${
                      isDone ? "cursor-pointer" : ""
                    }`}
                  >
                    {poster ? (
                      <Image
                        src={poster}
                        alt={task.title}
                        fill
                        className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 bg-gradient-to-br from-zinc-900 to-zinc-950">
                        {task.type === "series" || task.type === "anime" ? (
                          <IconDeviceTv className="w-10 h-10 text-zinc-500" />
                        ) : (
                          <IconMovie className="w-10 h-10 text-zinc-500" />
                        )}
                        <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400">
                          {task.type === "series"
                            ? "Série"
                            : task.type === "anime"
                            ? "Anime"
                            : "Film"}
                        </span>
                      </div>
                    )}

                    {/* Gradient overlay for bottom shadow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

                    {/* Play button overlay on hover (YouTube style) */}
                    {isDone && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40">
                        <div className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                          <IconPlayerPlay className="w-6 h-6 fill-black ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* YouTube Badges: Bottom-right duration / size badge */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                      {task.totalBytes || task.bytesDownloaded ? (
                        <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-white text-[10px] font-semibold tracking-tight shadow">
                          {formatBytes(task.totalBytes || task.bytesDownloaded || 0)}
                        </span>
                      ) : null}
                    </div>

                    {/* Top-right Status Pill */}
                    <div className="absolute top-2 right-2">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/90 text-white text-[10px] font-black uppercase tracking-wider shadow">
                          <IconCheck className="w-3 h-3 stroke-[3]" />
                          Prêt
                        </span>
                      ) : isRunning ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D70466]/90 text-white text-[10px] font-black uppercase tracking-wider shadow animate-pulse">
                          En cours
                        </span>
                      ) : isPaused ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/90 text-white text-[10px] font-black uppercase tracking-wider shadow">
                          En pause
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-700/90 text-zinc-200 text-[10px] font-black uppercase tracking-wider shadow">
                          Arrêté
                        </span>
                      )}
                    </div>

                    {/* Top-left Type Tag */}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-zinc-300 text-[9px] font-bold uppercase tracking-wider">
                        {task.type === "series" ? "Série" : task.type === "anime" ? "Anime" : "Film"}
                      </span>
                    </div>
                  </div>

                  {/* YouTube Video Info Block */}
                  <div className="p-3.5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3
                          onClick={() => isDone && handleWatch(task)}
                          title={task.title}
                          className={`text-sm font-bold text-white line-clamp-1 group-hover:text-[#D70466] transition-colors ${
                            isDone ? "cursor-pointer" : ""
                          }`}
                        >
                          {task.title}
                        </h3>
                        <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                          {subtitle || (task.type === "movie" ? "Film complet" : task.filename)}
                        </p>
                      </div>

                      {/* Delete button or confirmation */}
                      {deleteConfirmId === task.id ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleDeleteOne(task.id)}
                            className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Supprimer
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <IconX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(task.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0"
                          title="Supprimer"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar and Action Buttons */}
                <div className="p-3.5 pt-0 space-y-2.5">
                  {(isRunning || isPaused) && (
                    <div className="space-y-1">
                      <DownloadProgressBar
                        bytesDownloaded={task.bytesDownloaded}
                        totalBytes={task.totalBytes}
                        status={task.status}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <button
                        onClick={() => handleWatch(task)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-extrabold text-xs transition-all cursor-pointer shadow active:scale-[0.98]"
                      >
                        <IconPlayerPlay className="w-3.5 h-3.5 fill-black" />
                        <span>Regarder hors-connexion</span>
                      </button>
                    ) : isRunning ? (
                      <>
                        <button
                          onClick={() => handlePauseOne(task.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <IconPlayerPause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                        <button
                          onClick={() => handleCancelOne(task.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <IconX className="w-3.5 h-3.5" />
                          <span>Annuler</span>
                        </button>
                      </>
                    ) : isPaused ? (
                      <>
                        <button
                          onClick={() => handleResumeOne(task)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white text-xs font-bold transition-colors cursor-pointer shadow"
                        >
                          <IconPlayerPlay className="w-3.5 h-3.5 fill-white" />
                          <span>Reprendre</span>
                        </button>
                        <button
                          onClick={() => handleCancelOne(task.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <IconX className="w-3.5 h-3.5" />
                          <span>Annuler</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRetryOne(task.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#D70466] hover:bg-[#b5034f] text-white text-xs font-bold transition-colors cursor-pointer shadow"
                      >
                        <IconRefresh className="w-3.5 h-3.5" />
                        <span>Relancer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : tasks.length === 0 ? (
        /* ÉCRAN VIDE */
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-zinc-900/80 border border-white/5 flex items-center justify-center text-brand-primary shadow-xl">
            <IconDownload className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Aucun téléchargement</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Téléchargez vos films et épisodes pour les regarder partout sans connexion internet.
            </p>
          </div>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold transition-all shadow-lg active:scale-95"
          >
            Explorer les films & séries
          </Link>
        </div>
      ) : (
        /* AUCUN RÉSULTAT POUR LE FILTRE */
        <div className="py-12 text-center text-xs text-zinc-400">
          Aucun résultat pour cette recherche.
        </div>
      )}

      {/* MODALE DE CONFIRMATION SUPPRESSION TOTALE */}
      {showClearAllModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowClearAllModal(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <IconAlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Effacer tous les téléchargements ?
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Tous les {tasks.length} fichiers de votre liste seront supprimés.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowClearAllModal(false)}
                className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleClearAll}
                className="py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Tout effacer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LECTEUR HORS-LIGNE DIRECT */}
      <OfflinePlayerModal
        isOpen={!!offlinePlayerTask}
        onClose={() => setOfflinePlayerTask(null)}
        task={offlinePlayerTask}
      />
    </div>
  );
}
