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
  /** Cancel a single task (e.g. user clicked "stop" on row). */
  cancelOne: (id: string) => void;
  /** Retry a single task — re-queues it and the pool picks it up. */
  retryOne: (id: string) => void;
  /** Cancel every task in this batch. */
  cancelAll: () => void;
  /** Force-requeue all non-terminal tasks (e.g. after a refresh). */
  resumeAll: () => void;
}

/**
 * useDownloadsBatch — orchestrates a batch of downloads with a fixed
 * concurrency pool of 3. Each task is independently retried up to MAX_RETRIES
 * times with exponential backoff on transient failure.
 */
export function useDownloadsBatch(args: UseDownloadsBatchArgs): UseDownloadsBatchReturn {
  const { tmdbId, seriesTitle, type, episodes, gated = false } = args;

  // Subscribe to *only* the fields we need, with shallow equality so we
  // don't re-render when every progress tick mutates `tasks`.
  const tasks = useDownloadsStore((s) => s.tasks);
  const addMany = useDownloadsStore((s) => s.addMany);
  const updateTask = useDownloadsStore((s) => s.update);
  const setStatus = useDownloadsStore((s) => s.setStatus);
  const setProgress = useDownloadsStore((s) => s.setProgress);
  const requestCancel = useDownloadsStore((s) => s.requestCancel);
  const isCancelRequested = useDownloadsStore((s) => s.isCancelRequested);

  // Stable map of per-task runtime state (abort controllers, retry timers).
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

  // Stable ref of the latest args so the worker loop doesn't re-create on
  // every render (the loop reads from refs).
  const argsRef = useRef(args);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    argsRef.current = args;
    tasksRef.current = tasks;
  }, [args, tasks]);

  // Seed the store with task rows on mount / when the episode list changes.
  // We only keep rows for the *current* selection so stale tasks from a
  // previous series open don't pile up in the store.
  useEffect(() => {
    const newRows: DownloadTask[] = episodes.map((ep) => {
      const id = downloadTaskId({
        tmdbId,
        season: ep.season,
        episodeNumber: ep.number,
      });
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
  }, [episodes, addMany, seriesTitle, tmdbId, type]);

  // Pool worker loop. Triggered by every `tasks` change — no setInterval
  // — so we never pick up an already-canceled task or schedule twice.
  useEffect(() => {
    let cancelled = false;
    const inflight = new Set<Promise<void>>();

    const pickNext = (): DownloadTask | undefined => {
      const runtime = runtimeRef.current;
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
      return seriesTasks.find(
        (t) =>
          (t.status === "queued" || (!gatedNow && t.status === "ready")) &&
          !runtime.has(t.id) &&
          !isCancelRequested(t.id),
      );
    };

    const runOne = async (task: DownloadTask) => {
      const { type, seriesTitle, tmdbId } = argsRef.current;
      // Fresh controller per attempt — never reuse across retries.
      const ctrl = new AbortController();
      runtimeRef.current.set(task.id, { ctrl, retries: 0, retryTimer: null });

      // Honour a cancel request that landed before we started.
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

        if (ctrl.signal.aborted) {
          setStatus(task.id, "canceled");
          return;
        }

        if (!result) {
          setStatus(task.id, "error", "Aucun lien trouvé");
          return;
        }

        updateTask(task.id, { resolvedUrl: result.downloadUrl });

        // Gated mode: stop at "ready" — the pool streams only once ungated.
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

        if (ctrl.signal.aborted) {
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
          // Always allocate a *fresh* controller for the retry: the previous
          // fetch may have left the old one in an aborted state.
          const nextCtrl = new AbortController();
          runtimeRef.current.set(task.id, {
            ctrl: nextCtrl,
            retries,
            retryTimer: null,
          });
          // Exponential backoff: 1s, 2s, 4s, ...
          const backoff = 1000 * Math.pow(2, retries - 1);
          const timer = setTimeout(() => {
            // If the whole batch was unmounted while we were waiting, drop it.
            if (cancelled) return;
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
        // Only clear if we're still the active run (a retry may have
        // replaced the runtime entry already).
        const cur = runtimeRef.current.get(task.id);
        if (cur?.ctrl === ctrl) {
          runtimeRef.current.delete(task.id);
        }
      }
    };

    // Continuously schedule until no more slots or tasks.
    const schedule = () => {
      while (inflight.size < MAX_CONCURRENT && !cancelled) {
        const next = pickNext();
        if (!next) break;
        const p = runOne(next).finally(() => inflight.delete(p));
        inflight.add(p);
      }
    };

    schedule();

    return () => {
      cancelled = true;
      // Tear down inflight controllers + clear any pending retry timers.
      runtimeRef.current.forEach(({ ctrl, retryTimer }) => {
        if (retryTimer) clearTimeout(retryTimer);
        ctrl.abort();
      });
      runtimeRef.current.clear();
    };
    // Re-runs whenever the task list changes — that's the only signal we need.
  }, [tasks, gated, isCancelRequested, setProgress, setStatus, updateTask]);

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
      } else {
        // If it's not in runtime, we must forcefully cancel it (e.g. queued/ready)
        setStatus(id, "canceled");
      }
    },
    [requestCancel, setStatus],
  );

  const retryOne = useCallback(
    (id: string) => {
      // Make sure no zombie controller is left over from a previous attempt.
      const stale = runtimeRef.current.get(id);
      if (stale?.retryTimer) clearTimeout(stale.retryTimer);
      runtimeRef.current.delete(id);
      setStatus(id, "queued");
    },
    [setStatus],
  );

  const cancelAll = useCallback(() => {
    // Iterate over a snapshot so we can mutate the map safely.
    const snapshot = Array.from(runtimeRef.current.entries());
    runtimeRef.current.clear();
    for (const [id, { ctrl, retryTimer }] of snapshot) {
      if (retryTimer) clearTimeout(retryTimer);
      requestCancel(id);
      ctrl.abort();
    }
    // Forcefully cancel any queued or ready tasks that weren't in runtime
    tasks.forEach((t) => {
      if (t.tmdbId === String(tmdbId)) {
        if (t.status === "queued" || t.status === "ready") {
          setStatus(t.id, "canceled");
        }
      }
    });
  }, [requestCancel, tasks, setStatus, tmdbId]);

  const resumeAll = useCallback(() => {
    tasks
      .filter((t) => t.tmdbId === String(tmdbId) && t.status === "paused")
      .forEach((t) => setStatus(t.id, "queued"));
  }, [tasks, setStatus, tmdbId]);

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
  };
}
