"use client";

import { IconDownload, IconPlayerPlay, IconReload, IconX } from "@tabler/icons-react";
import type { DownloadTask } from "@/types/download";
import DownloadProgressBar from "./DownloadProgressBar";

interface DownloadListItemProps {
  task: DownloadTask;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onStart?: (id: string) => void;
  showActions?: boolean;
}

/**
 * Single row in a download list. Reads purely from the task row — actions are
 * delegated to the parent so the same row renders in modals, drawers, and
 * notifications.
 */
export default function DownloadListItem({
  task,
  onCancel,
  onRetry,
  onStart,
  showActions = true,
}: DownloadListItemProps) {
  const isTerminal = task.status === "done" || task.status === "error" || task.status === "canceled";
  const isRunning = task.status === "downloading" || task.status === "resolving";

  const subtitle = task.episodeNumber != null
    ? `S${String(task.season ?? 1).padStart(2, "0")}E${String(task.episodeNumber).padStart(2, "0")}`
    : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-white">
              {task.title}
            </h4>
            {subtitle && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-bold text-zinc-300">
                {subtitle}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{task.filename}</p>
        </div>

        {showActions && (
          <div className="flex shrink-0 items-center gap-1">
            {isRunning && onCancel && (
              <button
                onClick={() => onCancel(task.id)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                title="Annuler"
                aria-label="Annuler"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
            {task.status === "error" && onRetry && (
              <button
                onClick={() => onRetry(task.id)}
                className="rounded-md p-1.5 text-amber-400 hover:bg-zinc-800 hover:text-amber-300"
                title="Réessayer"
                aria-label="Réessayer"
              >
                <IconReload className="h-4 w-4" />
              </button>
            )}
            {(task.status === "queued" || task.status === "paused") && onStart && (
              <button
                onClick={() => onStart(task.id)}
                className="rounded-md p-1.5 text-emerald-400 hover:bg-zinc-800 hover:text-emerald-300"
                title="Démarrer"
                aria-label="Démarrer"
              >
                <IconPlayerPlay className="h-4 w-4" />
              </button>
            )}
            {task.status === "done" && (
              <IconDownload className="h-4 w-4 text-emerald-400" />
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        <DownloadProgressBar
          bytesDownloaded={task.bytesDownloaded}
          totalBytes={task.totalBytes}
          status={task.status}
        />
        {task.status === "error" && task.error && (
          <p className="mt-2 text-xs text-rose-400">{task.error}</p>
        )}
        {!isTerminal && task.status !== "queued" && (
          <p className="mt-1 text-xs text-zinc-500">
            {task.status === "resolving"
              ? "Recherche du lien…"
              : task.status === "downloading"
              ? "Téléchargement en cours"
              : task.status}
          </p>
        )}
      </div>
    </div>
  );
}