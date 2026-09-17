"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  DownloadSimple, Check, Warning, Play, Pause, Trash, 
  ArrowsClockwise, FilmSlate, MagnifyingGlass, X, Television, 
  WifiSlash, DotsThreeVertical, GearSix, Info, CaretRight, ShieldCheck
} from "@phosphor-icons/react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { streamDownloadToDisk } from "@/services/streamSaver";
import { streamVideoToIndexedDB, getStorageQuota, type StorageQuotaInfo } from "@/services/offlineStorage";
import { useDownloadsStore } from "@/store/downloads";
import DownloadProgressBar from "@/features/downloads/DownloadProgressBar";
import OfflinePlayerModal from "@/features/downloads/OfflinePlayerModal";
import type { DownloadTask } from "@/types/download";
import { formatBytes } from "@/lib/format";
import { resolveDownloadUrl } from "@/services/downloads";
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
  const [filter, setFilter] = useState<"all" | "done" | "running" | "error">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [offlinePlayerTask, setOfflinePlayerTask] = useState<DownloadTask | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<StorageQuotaInfo | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close 3-dots menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, []);

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
    setActiveMenuId(null);
  };

  const handlePauseOne = (id: string) => {
    const ctrl = getController(id);
    ctrl?.abort();
    removeController(id);
    setStatus(id, "paused");
    setActiveMenuId(null);
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
    setActiveMenuId(null);
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
    setActiveMenuId(null);
    const targetTask = tasks.find((t) => t.id === id);
    if (!targetTask) return;
    resetTasks([id]);
    await handleResumeOne(targetTask);
  };

  const handleDeleteOne = (id: string) => {
    handleCancelOne(id);
    removeTask(id);
    setDeleteConfirmId(null);
    setActiveMenuId(null);
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

  const handleWatch = (task: DownloadTask) => {
    setActiveMenuId(null);
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

  const goToDetails = (task: DownloadTask) => {
    setActiveMenuId(null);
    const typeParam = task.type === "series" || task.type === "anime" ? "tv" : "movie";
    if (typeParam === "tv") {
      router.push(`/tv/${task.tmdbId || task.id}`);
    } else {
      router.push(`/media/${task.tmdbId || task.id}?type=movie`);
    }
  };

  return (
    <div className="w-full space-y-6 select-none">
      {/* ── 1. EN-TÊTE EXACT YOUTUBE STYLE (Titre + Paramètres) ─────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Téléchargements
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-medium">
            Vos téléchargements <span className="text-zinc-600">•</span> {tasks.length} vidéo{tasks.length > 1 ? "s" : ""}
            {doneTasks.length > 0 && ` (${formatBytes(totalBytesDone)})`}
          </p>
        </div>

        {/* Bouton Paramètres Style YouTube */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/profile?tab=settings")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[3px] bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <GearSix className="w-4 h-4" />
            <span>Paramètres</span>
          </button>
        </div>
      </div>

      {/* ── 2. FILTRES MINIMAUX & RECHERCHE ───────────────────────── */}
      {tasks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Pills Filtres YouTube */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: "all", label: `Tous (${tasks.length})` },
              { id: "done", label: `Prêts (${doneTasks.length})` },
              { id: "running", label: `En cours (${runningTasks.length})` },
              ...(errorTasks.length > 0 ? [{ id: "error", label: `Erreurs (${errorTasks.length})` }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-[3px] text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  filter === tab.id
                    ? "bg-white text-black shadow-sm"
                    : "bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-white/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Recherche & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <MagnifyingGlass className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-[3px] pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {doneTasks.length > 0 && (
              <button
                onClick={handleClearFinished}
                className="px-3 py-1.5 rounded-[3px] bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                Nettoyer
              </button>
            )}

            <button
              onClick={() => setShowClearAllModal(true)}
              className="px-3 py-1.5 rounded-[3px] bg-zinc-900 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-red-400 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Tout effacer
            </button>
          </div>
        </div>
      )}

      {/* ── 3. GRILLE VIDÉO YOUTUBE (16:9 + Titre + 3 Points) ───────── */}
      {filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 w-full">
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
                ? `Saison ${task.season ?? 1} • Épisode ${task.episodeNumber}`
                : task.type === "movie"
                ? "Film complet"
                : "Chillers";
            const poster = getPosterUrl(task);
            const isMenuOpen = activeMenuId === task.id;

            return (
              <div
                key={task.id}
                className="group flex flex-col justify-start bg-transparent transition-all duration-200 w-full relative"
              >
                {/* 1. Miniature 16:9 YouTube avec badges discrets */}
                <div
                  onClick={() => isDone && handleWatch(task)}
                  className={`relative aspect-video w-full rounded-[3px] overflow-hidden bg-zinc-900 border border-white/10 group-hover:border-white/25 transition-all shadow-md ${
                    isDone ? "cursor-pointer" : ""
                  }`}
                >
                  {poster ? (
                    <Image
                      src={poster}
                      alt={task.title}
                      fill
                      className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 bg-gradient-to-br from-zinc-900 to-zinc-950">
                      {task.type === "series" || task.type === "anime" ? (
                        <Television className="w-8 h-8 text-zinc-500" />
                      ) : (
                        <FilmSlate className="w-8 h-8 text-zinc-500" />
                      )}
                      <span className="text-[10px] font-bold tracking-wider uppercase text-zinc-400">
                        {task.type === "series" ? "Série" : task.type === "anime" ? "Anime" : "Film"}
                      </span>
                    </div>
                  )}

                  {/* Dégradé léger en bas */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                  {/* Play overlay hover */}
                  {isDone && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40">
                      <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-5 h-5 fill-black ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Badge Durée / Taille en bas à droite (Style YouTube exact) */}
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 z-10">
                    <span className="px-1.5 py-0.5 rounded-[2px] bg-black/90 text-white text-[10px] font-mono font-bold tracking-tight shadow">
                      {task.totalBytes || task.bytesDownloaded
                        ? formatBytes(task.totalBytes || task.bytesDownloaded || 0)
                        : isDone
                        ? "HD"
                        : "..."}
                    </span>
                  </div>

                  {/* Barre de progression rouge en bas de la miniature si en cours */}
                  {isRunning && (
                    <div className="absolute bottom-0 inset-x-0 h-[3px] bg-zinc-800 z-10">
                      <div
                        className="h-full bg-red-600 rounded-r-full shadow-[0_0_6px_rgba(220,38,38,0.8)] transition-all duration-300"
                        style={{
                          width: `${
                            task.totalBytes && task.totalBytes > 0
                              ? Math.min(100, Math.round(((task.bytesDownloaded || 0) / task.totalBytes) * 100))
                              : 20
                          }%`,
                        }}
                      />
                    </div>
                  )}

                  {/* Badge statut si erreur ou pause */}
                  {isPaused && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-amber-500/90 text-black text-[9px] font-black uppercase">
                        Pause
                      </span>
                    </div>
                  )}
                  {isError && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-red-600 text-white text-[9px] font-black uppercase">
                        Erreur
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Ligne Info YouTube sous la miniature : Titre + 3 Points */}
                <div className="pt-2 px-0.5 flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <h3
                      onClick={() => isDone && handleWatch(task)}
                      title={task.title}
                      className={`text-xs sm:text-sm font-bold text-white line-clamp-2 leading-tight group-hover:text-brand-primary transition-colors ${
                        isDone ? "cursor-pointer" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5 font-normal leading-tight">
                      {subtitle} {task.totalBytes ? `• ${formatBytes(task.totalBytes)}` : ""}
                    </p>
                  </div>

                  {/* Bouton 3 Points Verticaux ⋮ */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(isMenuOpen ? null : task.id);
                      }}
                      aria-label="Options"
                      className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <DotsThreeVertical className="w-4 h-4" />
                    </button>

                    {/* Menu contextuel déroulant (3 Points) */}
                    {isMenuOpen && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 w-48 bg-[#18181c] border border-white/15 rounded-[3px] shadow-2xl p-1 z-30 flex flex-col divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          {isDone && (
                            <button
                              onClick={() => handleWatch(task)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer text-left"
                            >
                              <Play className="w-3.5 h-3.5 fill-white text-white" />
                              <span>Regarder</span>
                            </button>
                          )}

                          <button
                            onClick={() => goToDetails(task)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer text-left"
                          >
                            <Info className="w-3.5 h-3.5" />
                            <span>Voir les détails</span>
                          </button>

                          {isRunning && (
                            <button
                              onClick={() => handlePauseOne(task.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-amber-400 hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer text-left"
                            >
                              <Pause className="w-3.5 h-3.5" />
                              <span>Mettre en pause</span>
                            </button>
                          )}

                          {isPaused && (
                            <button
                              onClick={() => handleResumeOne(task)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer text-left"
                            >
                              <Play className="w-3.5 h-3.5 fill-emerald-400" />
                              <span>Reprendre</span>
                            </button>
                          )}

                          {isError && (
                            <button
                              onClick={() => handleRetryOne(task.id)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer text-left"
                            >
                              <ArrowsClockwise className="w-3.5 h-3.5" />
                              <span>Relancer</span>
                            </button>
                          )}
                        </div>

                        <div className="py-1">
                          <button
                            onClick={() => handleDeleteOne(task.id)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 rounded-[2px] transition-colors cursor-pointer text-left"
                          >
                            <Trash className="w-3.5 h-3.5" />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      </div>
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
          <div className="w-14 h-14 rounded-[3px] bg-zinc-900 border border-white/10 flex items-center justify-center text-brand-primary shadow-xl">
            <DownloadSimple className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Aucun téléchargement</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Téléchargez vos films et épisodes pour les regarder partout sans connexion internet.
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 rounded-[3px] bg-brand-primary hover:bg-[#b5034f] text-white text-xs font-bold transition-all shadow-md active:scale-95"
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
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowClearAllModal(false)}
        >
          <div
            className="bg-[#141417] border border-white/15 rounded-[3px] p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto">
              <Warning className="w-6 h-6" />
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
                className="py-2.5 rounded-[3px] bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleClearAll}
                className="py-2.5 rounded-[3px] bg-[#D70466] hover:bg-[#b5034f] text-xs font-semibold text-white transition-colors cursor-pointer"
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
