"use client";

import { useEffect, useRef } from "react";
import { useDownloadsStore } from "@/store/downloads";
import type { DownloadTask } from "@/types/download";

export interface DownloadSuccessPayload {
  id: string;
  title: string;
  filename: string;
  posterUrl?: string;
  season?: number;
  episodeNumber?: number;
}

/** Custom event dispatched on window when a download completes. */
export const DOWNLOAD_SUCCESS_EVENT = "chillers:download:success";

/**
 * Mount this hook once at the app root level (AppShell).
 * It watches every task in the global downloads store and fires a
 * window CustomEvent whenever a task transitions to "done".
 */
export function useDownloadToastEmitter() {
  const tasks = useDownloadsStore((s) => s.tasks);
  const isInitialized = useRef(false);
  // Track previously-seen statuses so we only fire on the *transition*.
  const prevStatuses = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const prev = prevStatuses.current;

    // On initial mount / hydration, record the current status of all existing tasks
    // without firing stale success toasts for downloads that finished previously.
    if (!isInitialized.current) {
      isInitialized.current = true;
      for (const task of tasks) {
        prev.set(task.id, task.status);
      }
      return;
    }

    for (const task of tasks) {
      const was = prev.get(task.id);
      // Only fire if the task genuinely transitioned to 'done' from an active state in this session
      if (task.status === "done" && was && was !== "done") {
        const payload: DownloadSuccessPayload = {
          id: task.id,
          title: task.title,
          filename: task.filename,
          posterUrl: task.posterUrl,
          season: task.season,
          episodeNumber: task.episodeNumber,
        };
        window.dispatchEvent(
          new CustomEvent(DOWNLOAD_SUCCESS_EVENT, { detail: payload }),
        );
      }
      prev.set(task.id, task.status);
    }

    // Prune tasks that no longer exist
    const taskIds = new Set(tasks.map((t) => t.id));
    for (const id of Array.from(prev.keys())) {
      if (!taskIds.has(id)) prev.delete(id);
    }
  }, [tasks]);
}
