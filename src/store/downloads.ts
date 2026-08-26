"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DownloadTask, DownloadStatus, DownloadProgress } from "@/types/download";

interface DownloadsState {
  tasks: DownloadTask[];

  addMany: (tasks: DownloadTask[]) => void;
  update: (id: string, patch: Partial<DownloadTask>) => void;
  remove: (id: string) => void;
  clear: () => void;

  /** Atomic status + progress update to avoid tearing under fast updates. */
  setProgress: (id: string, progress: DownloadProgress) => void;
  setStatus: (id: string, status: DownloadStatus, error?: string) => void;

  cancelRequested: Set<string>;
  requestCancel: (id: string) => void;
  clearCancelRequest: (id: string) => void;
  clearAllCancelRequests: () => void;
  isCancelRequested: (id: string) => boolean;
  resetTasks: (ids: string[]) => void;
}

const STORAGE_KEY = "chillers_downloads_v2";

/**
 * Pick only the *persisted* fields for the localStorage snapshot.
 *
 * `bytesDownloaded` is intentionally excluded: after a reload there's no
 * backing file on disk, so reporting a partial value would be a lie and
 * confuse the progress bar in the UI. We restore a sensible "0 of N" view.
 * `cancelRequested` is also dropped — once a tab is reloaded the abort
 * requests have no controller to bind to.
 */
const partialize = (state: DownloadsState) => ({
  tasks: state.tasks.map((t) => ({
    id: t.id,
    tmdbId: t.tmdbId,
    title: t.title,
    type: t.type,
    filename: t.filename,
    season: t.season,
    episodeNumber: t.episodeNumber,
    resolvedUrl: t.resolvedUrl,
    totalBytes: t.totalBytes,
    status: t.status,
    error: t.error,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    // Keep the episode metadata so the UI can still display the row's
    // title / thumbnail after a reload.
    episode: t.episode,
  })),
});

export const useDownloadsStore = create<DownloadsState>()(
  persist(
    (set, get) => ({
      tasks: [],
      cancelRequested: new Set<string>(),

      addMany: (newTasks) =>
        set((state) => {
          const existingIds = new Set(state.tasks.map((t) => t.id));
          const additions = newTasks.filter((t) => !existingIds.has(t.id));
          if (additions.length === 0) return state;
          return { tasks: [...state.tasks, ...additions] };
        }),

      update: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
          ),
        })),

      remove: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      clear: () => set({ tasks: [] }),

      /**
       * Progress updates are intentionally NOT persisted (see partialize).
       * The store mutates the in-memory state but does not write to
       * localStorage at every chunk.
       */
      setProgress: (id, progress) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  bytesDownloaded: progress.bytesDownloaded,
                  totalBytes: progress.totalBytes ?? t.totalBytes,
                  updatedAt: Date.now(),
                }
              : t,
          ),
        })),

      setStatus: (id, status, error) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, status, error, updatedAt: Date.now() }
              : t,
          ),
        })),

      requestCancel: (id) => {
        const next = new Set(get().cancelRequested);
        next.add(id);
        set({ cancelRequested: next });
      },

      clearCancelRequest: (id) => {
        const next = new Set(get().cancelRequested);
        next.delete(id);
        set({ cancelRequested: next });
      },

      clearAllCancelRequests: () => {
        set({ cancelRequested: new Set<string>() });
      },

      isCancelRequested: (id) => get().cancelRequested.has(id),

      resetTasks: (ids) => {
        const idSet = new Set(ids);
        const nextCancel = new Set(get().cancelRequested);
        for (const id of ids) nextCancel.delete(id);
        set((state) => ({
          cancelRequested: nextCancel,
          tasks: state.tasks.map((t) =>
            idSet.has(t.id)
              ? {
                  ...t,
                  status: "queued" as DownloadStatus,
                  resolvedUrl: null,
                  bytesDownloaded: 0,
                  totalBytes: null,
                  error: undefined,
                  updatedAt: Date.now(),
                }
              : t,
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      partialize,
      // Restore: drop any "downloading" rows since they can't survive a reload,
      // and zero out the partial byte counter that has no file backing it.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.tasks = state.tasks.map((t) =>
          t.status === "downloading" || t.status === "resolving"
            ? {
                ...t,
                status: "paused" as DownloadStatus,
                bytesDownloaded: 0,
                error: t.error ?? "Reprise après actualisation",
              }
            : { ...t, bytesDownloaded: 0 },
        );
      },
    },
  ),
);

/** Convenience selector for one task. */
export function selectTask(id: string) {
  return (s: DownloadsState) => s.tasks.find((t) => t.id === id);
}
