"use client";

import { useCallback, useEffect, useRef } from "react";
import { resolveDownloadUrl, proxyDownloadHref, isDownloadableUrl } from "@/services/downloads";
import { streamDownloadToDisk, isIOS } from "@/services/streamSaver";
import { buildEpisodeFilename, downloadTaskId } from "@/lib/format";
import type { DownloadTask } from "@/types/download";
import type { Episode } from "@/types/media";
import { useDownloadsStore } from "@/store/downloads";

/** Un seul flux à la fois : les liens HLS sont convertis par FFmpeg côté backend, deux
 *  conversions simultanées saturent le service et font tomber les téléchargements. */
const MAX_CONCURRENT_DOWNLOADS = 1;
/** La résolution est plus légère et doit rester rapide quand l'utilisateur sélectionne 20 épisodes. */
const MAX_CONCURRENT_RESOLVES = 3;
const MAX_RETRIES = 2;

export interface UseDownloadsBatchArgs {
  tmdbId: string | number;
  seriesTitle: string;
  type: "series" | "anime";
  episodes: Episode[];
  language?: "fr" | "vostfr";
  /** Phase 1 when true: every link is resolved to "ready" but nothing is streamed.
   *  Flip it to false (user clicks "Télécharger") to launch the download pool. */
  gated?: boolean;
}

export interface UseDownloadsBatchReturn {
  tasks: DownloadTask[];
  /** Aggregate counters used for the parent modal's UI. */
  totals: {
    total: number;
    queued: number;
    ready: number;
    running: number;
    done: number;
    failed: number;
    canceled: number;
  };
  cancelOne: (id: string) => void;
  retryOne: (id: string) => void;
  cancelAll: () => void;
  resumeAll: () => void;
  relaunchAll: () => void;
}

export function useDownloadsBatch(args: UseDownloadsBatchArgs): UseDownloadsBatchReturn {
  const { tmdbId, seriesTitle, type, episodes, gated = false } = args;

  const tasks = useDownloadsStore((s) => s.tasks);
  const addMany = useDownloadsStore((s) => s.addMany);
  const updateTask = useDownloadsStore((s) => s.update);
  const setStatus = useDownloadsStore((s) => s.setStatus);
  const setProgress = useDownloadsStore((s) => s.setProgress);
  const requestCancel = useDownloadsStore((s) => s.requestCancel);
  const clearCancelRequest = useDownloadsStore((s) => s.clearCancelRequest);
  const isCancelRequested = useDownloadsStore((s) => s.isCancelRequested);
  const resetTasks = useDownloadsStore((s) => s.resetTasks);
  const setController = useDownloadsStore((s) => s.setController);
  const getController = useDownloadsStore((s) => s.getController);
  const removeController = useDownloadsStore((s) => s.removeController);

  const retriesRef = useRef<Map<string, number>>(new Map());
  const retryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const inflightRef = useRef<Set<string>>(new Set());
  const unmountedRef = useRef(false);

  const argsRef = useRef(args);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    argsRef.current = args;
    tasksRef.current = tasks;
  }, [args, tasks]);

  // Seed tasks as soon as episodes are handed to the hook: phase 1 (gated) needs
  // rows to resolve links before anything is streamed.
  useEffect(() => {
    if (!episodes || episodes.length === 0) return;

    // Identifiants alignés sur ceux de la liste et de relaunchAll : sans suffixe
    // langue, sinon les lignes VOSTFR ne correspondent à aucune tâche.
    const ids = episodes.map((ep) =>
      downloadTaskId({
        tmdbId,
        season: ep.season ?? 1,
        episodeNumber: ep.number,
      })
    );

    const newRows: DownloadTask[] = episodes.map((ep, idx) => {
      const id = ids[idx];
      return {
        id,
        tmdbId: String(tmdbId),
        title: seriesTitle,
        type,
        posterUrl: ep.thumbnail,
        backdropUrl: ep.thumbnail,
        filename: buildEpisodeFilename({
          title: seriesTitle,
          season: ep.season ?? 1,
          episodeNumber: ep.number,
          extension: "mp4",
        }),
        season: ep.season ?? 1,
        episodeNumber: ep.number,
        episode: ep,
        resolvedUrl: null,
        bytesDownloaded: 0,
        totalBytes: null,
        status: "queued",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });
    addMany(newRows);

    // If any of the requested episodes were previously done, canceled, paused or in error, reset them fresh
    const currentTasks = tasksRef.current;
    const toReset = currentTasks
      .filter((t) => ids.includes(t.id) && t.status !== "downloading" && t.status !== "resolving")
      .map((t) => t.id);
    if (toReset.length > 0) {
      resetTasks(toReset);
    }
  }, [episodes, addMany, resetTasks, seriesTitle, tmdbId, type]);

  // Main task execution
  const runOne = useCallback(async (task: DownloadTask) => {
    if (unmountedRef.current) return;
    const { type, seriesTitle, tmdbId, language: currentLang = "fr" } = argsRef.current;

    const ctrl = new AbortController();
    setController(task.id, ctrl);
    inflightRef.current.add(task.id);

    if (isCancelRequested(task.id)) {
      ctrl.abort();
    }

    try {
      setStatus(task.id, "resolving");

      let result: { downloadUrl: string; fileCode: string } | null = null;
      if (task.resolvedUrl) {
        result = { downloadUrl: task.resolvedUrl, fileCode: "" };
      } else {
        result = await resolveDownloadUrl(
          tmdbId,
          type,
          seriesTitle,
          task.season,
          task.episodeNumber,
          currentLang,
        );
      }

      if (ctrl.signal.aborted || isCancelRequested(task.id)) {
        setStatus(task.id, "canceled");
        return;
      }

      if (!result || !result.downloadUrl) {
        setStatus(task.id, "error", "Aucun lien trouvé");
        return;
      }

      const cleanName = (task.filename || `${seriesTitle}.mp4`).replace(/[^a-zA-Z0-9_\-]/g, '_');
      const rawUrl = result.downloadUrl;
      const isHls = /\.m3u8(\?|$)/i.test(rawUrl);
      const isVideo = /\.(mp4|mkv|webm|m4v)(\?|$)/i.test(rawUrl);
      let finalUrl = rawUrl;
      if (isHls) {
        finalUrl = `/api/download/stream?m3u8=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(cleanName)}`;
      } else if (isVideo && rawUrl.startsWith('http')) {
        finalUrl = `/api/download/file?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(cleanName)}`;
      }

      // Le résolveur renvoie parfois la page de l'hébergeur : ni flux ni fichier,
      // le télécharger échouerait silencieusement ou éjecterait l'app vers le site tiers.
      if (!isDownloadableUrl(finalUrl)) {
        setStatus(task.id, "error", "Aucun fichier vidéo n'a pu être extrait pour cette version");
        return;
      }

      updateTask(task.id, { resolvedUrl: finalUrl, resolvedUrlAt: Date.now() });

      // Phase 1 : on s'arrête au lien prêt.
      // Sur iOS, WebKit n'autorise qu'un fichier par geste utilisateur : la liste
      // déclenche chaque épisode elle-même, un pool automatique produirait des "Terminé" vides.
      if (argsRef.current.gated || isIOS()) {
        setStatus(task.id, "ready");
        return;
      }

      setStatus(task.id, "downloading");

      try {
        // Téléchargement direct sur disque pour tous les utilisateurs (aucun IndexedDB)
        await streamDownloadToDisk(finalUrl, {
          filename: task.filename,
          signal: ctrl.signal,
          saveBlob: false,
          onProgress: (bytes, total) => {
            setProgress(task.id, {
              bytesDownloaded: bytes,
              totalBytes: total,
              percent:
                total && total > 0
                  ? Math.min(100, Math.round((bytes / total) * 100))
                  : null,
            });
          },
        });
      } catch (streamErr) {
        if (ctrl.signal.aborted || isCancelRequested(task.id)) {
          throw streamErr;
        }
        console.warn(`[Download] Erreur stream pour ${task.filename}:`, streamErr);
        // Fallback sécurisé : déclenchement du téléchargement direct navigateur
        if (typeof window !== "undefined") {
          const href = proxyDownloadHref(finalUrl, task.filename);
          const a = document.createElement("a");
          a.href = href;
          a.download = task.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          throw streamErr;
        }
      }

      if (ctrl.signal.aborted || isCancelRequested(task.id)) {
        setStatus(task.id, "canceled");
      } else {
        setStatus(task.id, "done");
      }
    } catch (err) {
      const wasAborted = ctrl.signal.aborted || isCancelRequested(task.id);
      if (wasAborted) {
        setStatus(task.id, "canceled");
        return;
      }

      const prevRetries = retriesRef.current.get(task.id) ?? 0;
      const retries = prevRetries + 1;
      if (retries <= MAX_RETRIES) {
        retriesRef.current.set(task.id, retries);
        const backoff = 1000 * Math.pow(2, retries - 1);
        const timer = setTimeout(() => {
          if (unmountedRef.current) return;
          retryTimersRef.current.delete(task.id);
          setStatus(task.id, "queued");
        }, backoff);
        retryTimersRef.current.set(task.id, timer);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(task.id, "error", message);
      }
    } finally {
      inflightRef.current.delete(task.id);
      removeController(task.id);
    }
  }, [isCancelRequested, setProgress, setStatus, updateTask, setController, removeController]);

  // Scheduler loop: phase 1 resolves links, phase 2 streams them one by one.
  const schedule = useCallback(() => {
    if (unmountedRef.current) return;
    const episodesNow = argsRef.current.episodes;
    const gatedNow = argsRef.current.gated ?? false;
    const iosNow = isIOS();
    const currentTasks = tasksRef.current;
    const seriesTasks = currentTasks.filter(
      (t) =>
        t.tmdbId === String(argsRef.current.tmdbId) &&
        episodesNow.some(
          (ep) => ep.number === t.episodeNumber && ep.season === t.season,
        ),
    );

    const limit = gatedNow ? MAX_CONCURRENT_RESOLVES : MAX_CONCURRENT_DOWNLOADS;

    while (inflightRef.current.size < limit && !unmountedRef.current) {
      const next = seriesTasks.find(
        (t) =>
          (t.status === "queued" || (!gatedNow && !iosNow && t.status === "ready")) &&
          !inflightRef.current.has(t.id) &&
          !isCancelRequested(t.id),
      );
      if (!next) break;

      runOne(next).finally(() => {
        schedule();
      });
    }
  }, [isCancelRequested, runOne]);

  useEffect(() => {
    schedule();
  }, [tasks, gated, schedule]);

  // Cleanup on unmount — clear timers without aborting background downloads
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      // Clear retry timers
      retryTimersRef.current.forEach((timer) => clearTimeout(timer));
      retryTimersRef.current.clear();
    };
  }, []);

  const cancelOne = useCallback(
    (id: string) => {
      requestCancel(id);
      const ctrl = getController(id);
      ctrl?.abort();
      removeController(id);
      const timer = retryTimersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        retryTimersRef.current.delete(id);
      }
      retriesRef.current.delete(id);
      inflightRef.current.delete(id);
      setStatus(id, "canceled");
    },
    [requestCancel, setStatus, getController, removeController],
  );

  const retryOne = useCallback(
    (id: string) => {
      const timer = retryTimersRef.current.get(id);
      if (timer) clearTimeout(timer);
      retryTimersRef.current.delete(id);
      retriesRef.current.delete(id);
      removeController(id);
      inflightRef.current.delete(id);
      clearCancelRequest(id);
      resetTasks([id]);
    },
    [clearCancelRequest, resetTasks, removeController],
  );

  const relaunchAll = useCallback(() => {
    const ids = episodes.map((ep) =>
      downloadTaskId({
        tmdbId,
        season: ep.season,
        episodeNumber: ep.number,
      })
    );
    for (const id of ids) {
      const timer = retryTimersRef.current.get(id);
      if (timer) clearTimeout(timer);
      retryTimersRef.current.delete(id);
      retriesRef.current.delete(id);
      removeController(id);
      inflightRef.current.delete(id);
    }
    resetTasks(ids);
  }, [episodes, resetTasks, tmdbId, removeController]);

  const cancelAll = useCallback(() => {
    const snapshot = Array.from(inflightRef.current);
    inflightRef.current.clear();
    for (const id of snapshot) {
      const timer = retryTimersRef.current.get(id);
      if (timer) clearTimeout(timer);
      retryTimersRef.current.delete(id);
      retriesRef.current.delete(id);
      const ctrl = getController(id);
      requestCancel(id);
      ctrl?.abort();
      removeController(id);
    }
    retryTimersRef.current.clear();
    retriesRef.current.clear();
    tasks.forEach((t) => {
      if (t.tmdbId === String(tmdbId)) {
        if (t.status === "queued" || t.status === "ready" || t.status === "resolving" || t.status === "downloading") {
          setStatus(t.id, "canceled");
        }
      }
    });
  }, [requestCancel, tasks, setStatus, tmdbId, getController, removeController]);

  const resumeAll = useCallback(() => {
    const ids = tasks
      .filter((t) => t.tmdbId === String(tmdbId) && (t.status === "paused" || t.status === "canceled"))
      .map((t) => t.id);
    resetTasks(ids);
  }, [tasks, resetTasks, tmdbId]);

  const requestedIds = new Set(
    episodes.map((ep) =>
      downloadTaskId({
        tmdbId,
        season: ep.season ?? 1,
        episodeNumber: ep.number,
      })
    )
  );

  const relevantTasks = tasks.filter((t) => requestedIds.has(t.id));

  const totals = relevantTasks.reduce(
    (acc, t) => {
      acc.total++;
      if (t.status === "queued" || t.status === "resolving") acc.queued++;
      if (t.status === "ready") acc.ready++;
      if (t.status === "downloading") acc.running++;
      if (t.status === "done") acc.done++;
      if (t.status === "error") acc.failed++;
      if (t.status === "canceled") acc.canceled++;
      return acc;
    },
    { total: 0, queued: 0, ready: 0, running: 0, done: 0, failed: 0, canceled: 0 },
  );

  return {
    tasks: relevantTasks,
    totals,
    cancelOne,
    retryOne,
    cancelAll,
    resumeAll,
    relaunchAll,
  };
}
