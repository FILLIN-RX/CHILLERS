"use client";

import { useState } from "react";
import { IconX, IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { useDownloadsStore } from "@/store/downloads";
import { formatBytes } from "@/lib/format";
import DownloadProgressBar from "./DownloadProgressBar";

/**
 * Floating bar that appears when one or more downloads are active in the
 * background (i.e. the modal was closed while a download was running).
 * Shows per-task progress and a global dismiss. Persists until all
 * active downloads complete or are cancelled.
 */
export default function DownloadFloatingBar() {
  const tasks = useDownloadsStore((s) => s.tasks);
  const requestCancel = useDownloadsStore((s) => s.requestCancel);
  const getController = useDownloadsStore((s) => s.getController);
  const [dismissed, setDismissed] = useState(false);

  // Only show tasks that are actively downloading or resolving (background)
  const active = tasks.filter(
    (t) => t.status === "downloading" || t.status === "resolving",
  );

  // Also show recently completed/error tasks for a few seconds
  const recentDone = tasks.filter(
    (t) =>
      t.status === "done" &&
      Date.now() - t.updatedAt < 8_000,
  );

  const visible = [...active, ...recentDone];

  if (visible.length === 0 || dismissed) return null;

  const handleCancel = (taskId: string) => {
    requestCancel(taskId);
    const ctrl = getController(taskId);
    ctrl?.abort();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9998] w-80 max-w-[calc(100vw-2rem)]">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Téléchargement{active.length > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
            aria-label="Masquer"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Task list */}
        <div className="max-h-60 overflow-y-auto">
          {visible.map((t) => {
            const percent =
              t.totalBytes && t.totalBytes > 0
                ? Math.min(100, Math.round((t.bytesDownloaded / t.totalBytes) * 100))
                : null;

            return (
              <div
                key={t.id}
                className="px-4 py-3 border-b border-white/5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-white truncate flex-1 min-w-0">
                    {t.title}
                    {t.episodeNumber != null && (
                      <span className="text-zinc-500 font-normal ml-1.5 text-xs">
                        S{String(t.season ?? 1).padStart(2, "0")}E{String(t.episodeNumber).padStart(2, "0")}
                      </span>
                    )}
                  </p>

                  <div className="flex items-center gap-1.5 flex-none">
                    {t.status === "done" && (
                      <div className="flex items-center gap-1 text-emerald-400">
                        <IconCheck className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold">Terminé</span>
                      </div>
                    )}
                    {t.status === "error" && (
                      <div className="flex items-center gap-1 text-rose-400">
                        <IconAlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold">Erreur</span>
                      </div>
                    )}
                    {(t.status === "downloading" || t.status === "resolving") && (
                      <button
                        onClick={() => handleCancel(t.id)}
                        className="text-[10px] text-zinc-500 hover:text-white transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <DownloadProgressBar
                  bytesDownloaded={t.bytesDownloaded}
                  totalBytes={t.totalBytes}
                  status={t.status}
                />

                {/* Status text */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-zinc-500">
                    {t.status === "resolving"
                      ? "Recherche du lien…"
                      : t.status === "downloading"
                      ? percent != null
                        ? `${percent}%`
                        : "Calcul…"
                      : t.status === "done"
                      ? "Sauvegardé"
                      : ""}
                  </span>
                  {t.status === "downloading" && t.totalBytes != null && (
                    <span className="text-[10px] text-zinc-500">
                      {formatBytes(t.bytesDownloaded)} / {formatBytes(t.totalBytes)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
