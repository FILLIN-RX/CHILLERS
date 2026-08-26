"use client";

import { useCallback, useEffect, useRef } from "react";
import { resolveDownloadUrl } from "@/services/downloads";
import { streamDownloadToDisk } from "@/services/streamSaver";
import { buildEpisodeFilename, downloadTaskId } from "@/lib/format";
import type { DownloadTask } from "@/types/download";
import type { Episode } from "@/types/media";
import { useDownloadsStore } from "@/store/downloads";

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 2;

export interface UseDownloadsBatchArgs {
  tmdbId: string | number;
  seriesTitle: string;
  type: "series" | "anime";
  episodes: Episode[];
  /** When true, links are resolved to "ready" but nothing is streamed yet.
   *  Flip it to false (e.g. user clicks "Télécharger") to launch the pool. */
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

  const runtimeRef = useRef<
    Map<
      string,
      {
        ctrl: AbortController;
        retries: number;
        retryTimer: ReturnType<typeof setTimeout> | null;
      }
    >
  >(new Map());

  const inflightRef = useRef<Set<string>>(new Set());
  const unmountedRef = useRef(false);

  const argsRef = useRef(args);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    argsRef.current = args;
    tasksRef.current = tasks;
  }, [args, tasks]);

  // Seed tasks when episodes change & reset any canceled/stuck tasks
  useEffect(() => {
    const ids = episodes.map((ep) =>
      downloadTaskId({
        tmdbId,
        season: ep.season,
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
        filename: buildEpisodeFilename({
          title: seriesTitle,
          season: ep.season,
          episodeNumber: ep.number,
          extension: "mp4",
        }),
        season: ep.season,
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

    // If any of the requested episodes were canceled or paused, reset them fresh
    const currentTasks = tasksRef.current;
    const toReset = currentTasks
      .filter((t) => ids.includes(t.id) && (t.status === "canceled" || t.status === "paused"))
      .map((t) => t.id);
    if (toReset.length > 0) {
      resetTasks(toReset);
    }
  }, [episodes, addMany, resetTasks, seriesTitle, tmdbId, type]);

  // Main task execution
  const runOne = useCallback(async (task: DownloadTask) => {
    if (unmountedRef.current) return;
    const { type, seriesTitle, tmdbId } = argsRef.current;

    const ctrl = new AbortController();
    runtimeRef.current.set(task.id, { ctrl, retries: 0, retryTimer: null });
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
        );
      }

      if (ctrl.signal.aborted || isCancelRequested(task.id)) {
        setStatus(task.id, "canceled");
        return;
      }

      if (!result) {
        setStatus(task.id, "error", "Aucun lien trouvé");
        return;
      }

      updateTask(task.id, { resolvedUrl: result.downloadUrl });

      if (argsRef.current.gated) {
        setStatus(task.id, "ready");
        return;
      }

      setStatus(task.id, "downloading");

      await streamDownloadToDisk(result.downloadUrl, {
        filename: task.filename,
        signal: ctrl.signal,
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

      const prevRetries = runtimeRef.current.get(task.id)?.retries ?? 0;
      const retries = prevRetries + 1;
      if (retries <= MAX_RETRIES) {
        const nextCtrl = new AbortController();
        runtimeRef.current.set(task.id, {
          ctrl: nextCtrl,
          retries,
          retryTimer: null,
        });
        const backoff = 1000 * Math.pow(2, retries - 1);
        const timer = setTimeout(() => {
          if (unmountedRef.current) return;
          const cur = runtimeRef.current.get(task.id);
          if (cur?.retryTimer === timer) {
            cur.retryTimer = null;
          }
          setStatus(task.id, "queued");
        }, backoff);
        const cur = runtimeRef.current.get(task.id);
        if (cur) cur.retryTimer = timer;
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(task.id, "error", message);
      }
    } finally {
      inflightRef.current.delete(task.id);
      const cur = runtimeRef.current.get(task.id);
      if (cur?.ctrl === ctrl) {
        runtimeRef.current.delete(task.id);
      }
    }
  }, [isCancelRequested, setProgress, setStatus, updateTask]);

  // Scheduler loop: picks up queued/ready tasks up to concurrency limit
  const schedule = useCallback(() => {
    if (unmountedRef.current) return;
    const episodesNow = argsRef.current.episodes;
    const gatedNow = argsRef.current.gated ?? false;
    const currentTasks = tasksRef.current;
    const seriesTasks = currentTasks.filter(
      (t) =>
        t.tmdbId === String(argsRef.current.tmdbId) &&
        episodesNow.some(
          (ep) => ep.number === t.episodeNumber && ep.season === t.season,
        ),
    );

    while (inflightRef.current.size < MAX_CONCURRENT && !unmountedRef.current) {
      const next = seriesTasks.find(
        (t) =>
          (t.status === "queued" || (!gatedNow && t.status === "ready")) &&
          !inflightRef.current.has(t.id) &&
          !runtimeRef.current.has(t.id) &&
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

  // Cleanup ONLY on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      runtimeRef.current.forEach(({ ctrl, retryTimer }) => {
        if (retryTimer) clearTimeout(retryTimer);
        ctrl.abort();
      });
      runtimeRef.current.clear();
      inflightRef.current.clear();
    };
  }, []);

  const cancelOne = useCallback(
    (id: string) => {
      requestCancel(id);
      const entry = runtimeRef.current.get(id);
      if (entry) {
        if (entry.retryTimer) {
          clearTimeout(entry.retryTimer);
          entry.retryTimer = null;
        }
        entry.ctrl.abort();
        runtimeRef.current.delete(id);
      }
      inflightRef.current.delete(id);
      setStatus(id, "canceled");
    },
    [requestCancel, setStatus],
  );

  const retryOne = useCallback(
    (id: string) => {
      const stale = runtimeRef.current.get(id);
      if (stale?.retryTimer) clearTimeout(stale.retryTimer);
      runtimeRef.current.delete(id);
      inflightRef.current.delete(id);
      clearCancelRequest(id);
      resetTasks([id]);
    },
    [clearCancelRequest, resetTasks],
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
      const stale = runtimeRef.current.get(id);
      if (stale?.retryTimer) clearTimeout(stale.retryTimer);
      runtimeRef.current.delete(id);
      inflightRef.current.delete(id);
    }
    resetTasks(ids);
  }, [episodes, resetTasks, tmdbId]);

  const cancelAll = useCallback(() => {
    const snapshot = Array.from(runtimeRef.current.entries());
    runtimeRef.current.clear();
    inflightRef.current.clear();
    for (const [id, { ctrl, retryTimer }] of snapshot) {
      if (retryTimer) clearTimeout(retryTimer);
      requestCancel(id);
      ctrl.abort();
    }
    tasks.forEach((t) => {
      if (t.tmdbId === String(tmdbId)) {
        if (t.status === "queued" || t.status === "ready" || t.status === "resolving" || t.status === "downloading") {
          setStatus(t.id, "canceled");
        }
      }
    });
  }, [requestCancel, tasks, setStatus, tmdbId]);

  const resumeAll = useCallback(() => {
    const ids = tasks
      .filter((t) => t.tmdbId === String(tmdbId) && (t.status === "paused" || t.status === "canceled"))
      .map((t) => t.id);
    resetTasks(ids);
  }, [tasks, resetTasks, tmdbId]);

  const relevantTasks = tasks.filter((t) => t.tmdbId === String(tmdbId));

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
