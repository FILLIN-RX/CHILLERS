"use client";

import React from "react";
import { useDownloadsStore } from "@/store/downloads";
import { DownloadSimple, CheckCircle, Stop, CircleNotch } from "@phosphor-icons/react";
import { downloadTaskId } from "@/lib/format";

interface NetflixDownloadButtonProps {
  tmdbId: string | number;
  type?: "movie" | "series" | "anime";
  season?: number;
  episodeNumber?: number;
  title?: string;
  onClick?: () => void;
  variant?: "button" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function NetflixDownloadButton({
  tmdbId,
  type = "movie",
  season,
  episodeNumber,
  title,
  onClick,
  variant = "button",
  size = "md",
  className = "",
}: NetflixDownloadButtonProps) {
  const tasks = useDownloadsStore((s) => s.tasks);
  const requestCancel = useDownloadsStore((s) => s.requestCancel);

  const taskId = downloadTaskId({
    tmdbId,
    season,
    episodeNumber,
  });

  const activeTask = tasks.find((t) => t.id === taskId);
  const status = activeTask?.status;
  const progressPercent =
    activeTask?.totalBytes && activeTask.totalBytes > 0
      ? Math.min(100, Math.round((activeTask.bytesDownloaded / activeTask.totalBytes) * 100))
      : activeTask?.bytesDownloaded
        ? Math.min(99, Math.round((activeTask.bytesDownloaded / (1024 * 1024 * 800)) * 100))
        : 0;

  const isDownloading = status === "downloading" || status === "resolving" || status === "queued";
  const isDone = status === "done";

  const handleCancelOrAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading && activeTask) {
      requestCancel(activeTask.id);
      return;
    }
    if (onClick) onClick();
  };

  // 1. VARIANT ICON (pour les listes d'épisodes ou petits boutons)
  if (variant === "icon") {
    if (isDownloading) {
      return (
        <button
          type="button"
          onClick={handleCancelOrAction}
          className={`relative flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-transform active:scale-95 cursor-pointer group ${className}`}
          title={`Téléchargement en cours (${progressPercent}%). Cliquer pour annuler.`}
        >
          {/* Cercle SVG circulaire façon Netflix */}
          <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-zinc-700"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-brand-primary transition-all duration-300"
              strokeDasharray={`${progressPercent}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Stop className="w-2.5 h-2.5 text-white fill-current group-hover:scale-110 transition-transform" />
          </div>
        </button>
      );
    }

    if (isDone) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`p-2 rounded-full text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all ${className}`}
          title="Téléchargé sur votre appareil"
        >
          <CheckCircle className="w-5 h-5" weight="fill" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className={`p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer ${className}`}
        title="Télécharger"
      >
        <DownloadSimple className="w-5 h-5" />
      </button>
    );
  }

  // 2. VARIANT BUTTON (Bouton principal avec texte)
  if (isDownloading) {
    return (
      <button
        type="button"
        onClick={handleCancelOrAction}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-brand-primary/40 text-white font-semibold text-xs transition-all shadow-lg hover:border-brand-primary cursor-pointer active:scale-95 ${className}`}
      >
        {/* Anneau Circulaire de Progression Netflix */}
        <div className="relative flex items-center justify-center w-5 h-5">
          <svg className="w-5 h-5 -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-zinc-700"
              strokeWidth="4"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-brand-primary transition-all duration-300"
              strokeDasharray={`${progressPercent}, 100`}
              strokeWidth="4"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Stop className="w-2 h-2 text-white fill-current" />
          </div>
        </div>
        <span>Téléchargement {progressPercent > 0 ? `${progressPercent}%` : "..."}</span>
      </button>
    );
  }

  if (isDone) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-xs transition-all shadow-lg hover:bg-emerald-500/20 cursor-pointer ${className}`}
      >
        <CheckCircle className="w-4 h-4" weight="fill" />
        <span>Téléchargé</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs transition-all shadow-lg active:scale-95 cursor-pointer ${className}`}
    >
      <DownloadSimple className="w-4 h-4" />
      <span>{title || "Télécharger"}</span>
    </button>
  );
}
