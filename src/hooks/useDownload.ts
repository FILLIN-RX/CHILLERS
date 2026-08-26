"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveDownloadUrl } from "@/services/downloads";
import { streamDownloadToDisk } from "@/services/streamSaver";
import { buildEpisodeFilename, downloadTaskId } from "@/lib/format";
import type { DownloadTask, DownloadStatus } from "@/types/download";
import { useDownloadsStore } from "@/store/downloads";

/**
 * useDownload — drives a single-file download lifecycle.
 *
 * Two-phase: first resolve the URL through the backend, then stream bytes to
 * disk via StreamSaver with live progress. Exposes start/cancel/retry hooks.
 * The underlying task is registered in the global downloads store so other
 * panels (notification badge, drawer) can show the same state.
 *
 * AbortControllers are stored in the global Zustand store so downloads
 * survive component unmount (modal close). The modal can be dismissed
 * while the download continues in the background.
 */
export interface UseDownloadArgs {
  tmdbId: string | number;
  type: "movie" | "series" | "anime";
  title: string;
  season?: number;
  episodeNumber?: number;
}

export interface UseDownloadReturn {
  task: DownloadTask | undefined;
  status: DownloadStatus;
  /** 0..100, or null while byte size is unknown. */
  percent: number | null;
  error: string | null;
  /** Resolve the download URL without streaming (sets status to "ready"). */
  resolve: () => void;
  /** Stream the resolved URL to disk. Safe to call from the "ready" state. */
  start: () => void;
  cancel: () => void;
  retry: () => void;
  isRunning: boolean;
}

export function useDownload(args: UseDownloadArgs): UseDownloadReturn {
  const { tmdbId, type, title, season, episodeNumber } = args;
  const id = downloadTaskId({ tmdbId, season, episodeNumber });

  const addMany = useDownloadsStore((s) => s.addMany);
  const updateTask = useDownloadsStore((s) => s.update);
  const setStatus = useDownloadsStore((s) => s.setStatus);
  const setProgress = useDownloadsStore((s) => s.setProgress);
  const isCancelRequested = useDownloadsStore((s) => s.isCancelRequested);
  const requestCancel = useDownloadsStore((s) => s.requestCancel);
  const clearCancelRequest = useDownloadsStore((s) => s.clearCancelRequest);
  const resetTasks = useDownloadsStore((s) => s.resetTasks);
  const setController = useDownloadsStore((s) => s.setController);
  const getController = useDownloadsStore((s) => s.getController);
  const removeController = useDownloadsStore((s) => s.removeController);
  const task = useDownloadsStore((s) => s.tasks.find((t) => t.id === id));

  const [isRunning, setIsRunning] = useState(false);

  // Latest task ref so callbacks always read the freshest row without
  // re-creating on every store update (which would restart the download).
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  // Ensure the task row exists in the store before we drive it.
  useEffect(() => {
    if (task) {
      if (task.status === "canceled") {
        clearCancelRequest(id);
        resetTasks([id]);
      }
      return;
    }
    const filename = buildEpisodeFilename({
      title,
      season,
      episodeNumber,
      extension: "mp4",
    });
    addMany([
      {
        id,
        tmdbId: String(tmdbId),
        title,
        type,
        filename,
        season,
        episodeNumber,
        resolvedUrl: null,
        bytesDownloaded: 0,
        totalBytes: null,
        status: "queued",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);
    // We only want this on mount — the row is keyed by id, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = useCallback(() => {
    requestCancel(id);
    const ctrl = getController(id);
    ctrl?.abort();
  }, [id, requestCancel, getController]);

  const resolve = useCallback(async () => {
    if (isRunning) return;
    clearCancelRequest(id);
    setIsRunning(true);

    const ctrl = new AbortController();
    setController(id, ctrl);

    try {
      setStatus(id, "resolving");

      const result = await resolveDownloadUrl(
        tmdbId,
        type,
        title,
        season,
        episodeNumber,
      );

      if (ctrl.signal.aborted) {
        setStatus(id, "canceled");
        return;
      }

      if (!result) {
        setStatus(id, "error", "Aucun lien de téléchargement trouvé");
        return;
      }

      updateTask(id, { resolvedUrl: result.downloadUrl });
      setStatus(id, "ready");
    } catch (err) {
      if (ctrl.signal.aborted || isCancelRequested(id)) {
        setStatus(id, "canceled");
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(id, "error", message);
      }
    } finally {
      setIsRunning(false);
    }
  }, [id, isRunning, isCancelRequested, setStatus, tmdbId, type, title, season, episodeNumber, updateTask, setController, clearCancelRequest]);

  const streamCurrent = useCallback(async (url: string) => {
    setIsRunning(true);

    const ctrl = new AbortController();
    setController(id, ctrl);

    try {
      setStatus(id, "downloading");

      await streamDownloadToDisk(url, {
        filename: taskRef.current?.filename ?? `download-${id}.mp4`,
        signal: ctrl.signal,
        onProgress: (bytes, total) => {
          setProgress(id, {
            bytesDownloaded: bytes,
            totalBytes: total,
            percent:
              total && total > 0
                ? Math.min(100, Math.round((bytes / total) * 100))
                : null,
          });
        },
      });

      if (ctrl.signal.aborted) {
        setStatus(id, "canceled");
      } else {
        setStatus(id, "done");
      }
    } catch (err) {
      if (ctrl.signal.aborted || isCancelRequested(id)) {
        setStatus(id, "canceled");
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(id, "error", message);
      }
    } finally {
      removeController(id);
      setIsRunning(false);
    }
  }, [id, isCancelRequested, setProgress, setStatus, setController, removeController]);

  const start = useCallback(async () => {
    if (isRunning) return;
    const current = taskRef.current;
    if (current?.status === "ready" && current.resolvedUrl) {
      await streamCurrent(current.resolvedUrl);
      return;
    }
    await resolve();
    const afterResolve = taskRef.current;
    if (afterResolve?.status === "ready" && afterResolve.resolvedUrl) {
      await streamCurrent(afterResolve.resolvedUrl);
    }
  }, [isRunning, resolve, streamCurrent]);

  const retry = useCallback(() => {
    if (isRunning) return;
    setStatus(id, "queued");
    void resolve();
  }, [id, isRunning, setStatus, resolve]);

  // NOTE: We intentionally do NOT abort on unmount.
  // Downloads are tracked via global store controllers and continue
  // even after the modal / component is closed.

  const percent =
    task && task.totalBytes && task.totalBytes > 0
      ? Math.min(100, Math.round((task.bytesDownloaded / task.totalBytes) * 100))
      : null;

  return {
    task,
    status: task?.status ?? "queued",
    percent,
    error: task?.error ?? null,
    resolve,
    start,
    cancel,
    retry,
    isRunning,
  };
}
