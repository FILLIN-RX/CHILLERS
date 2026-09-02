"use client";

import { useEffect, useRef } from "react";
import { IconX, IconDownload, IconCheck, IconAlertTriangle } from "@tabler/icons-react";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import { useDownload } from "@/hooks/useDownload";
import type { DownloadStatus } from "@/types/download";
import { useLanguage } from "@/i18n/LanguageContext";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  id: string;
  type: "movie" | "series" | "anime";
  season?: number;
  episode?: number;
  posterUrl?: string;
  backdropUrl?: string;
}

const STATUS_LABEL: Record<DownloadStatus, string> = {
  queued: "En attente",
  resolving: "Recherche du lien…",
  ready: "Lien trouvé",
  downloading: "Téléchargement en cours",
  paused: "En pause",
  done: "Téléchargement réussi",
  error: "Erreur",
  canceled: "Annulé",
};

export default function DownloadModal({
  isOpen,
  onClose,
  title,
  id,
  type,
  season,
  episode,
  posterUrl,
  backdropUrl,
}: DownloadModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { translate: _ } = useLanguage();

  const dl = useDownload({
    tmdbId: id,
    type: type === "movie" ? "movie" : "series",
    title,
    season,
    episodeNumber: episode,
    posterUrl,
    backdropUrl,
  });

  // Scroll lock + ESC handler.
  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      releaseModalScrollLock();
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  // Auto-resolve: as soon as the modal opens, always resolve fresh if not actively downloading
  useEffect(() => {
    if (!isOpen) return;
    if (dl.status !== "downloading" && dl.status !== "resolving") {
      dl.retry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const showSpinner = dl.status === "resolving" || dl.status === "downloading";
  const showSuccess = dl.status === "done";
  const showError = dl.status === "error";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md mx-4 bg-[#141414] rounded-md shadow-2xl p-8 text-center"
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
        >
          <IconX className="h-5 w-5" />
        </button>

        <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-white/10">
          {showSpinner && (
            <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {showSuccess && (
            <div className="w-full h-full rounded-full bg-emerald-500/20 flex items-center justify-center">
              <IconCheck className="h-7 w-7 text-emerald-400" />
            </div>
          )}
          {showError && (
            <div className="w-full h-full rounded-full bg-red-500/20 flex items-center justify-center">
              <IconAlertTriangle className="h-7 w-7 text-red-400" />
            </div>
          )}
        </div>

        <h3 className="text-xl font-black text-white mb-1">{title}</h3>
        {episode != null && (
          <p className="text-zinc-400 text-sm mb-4">
            S{String(season ?? 1).padStart(2, "0")}E{String(episode).padStart(2, "0")}
          </p>
        )}

        <p className="text-zinc-400 text-sm mb-6">
          {dl.error ? dl.error : STATUS_LABEL[dl.status]}
        </p>

        {dl.status === "ready" && (
          <button
            onClick={() => { dl.start(); onClose(); }}
            className="w-full px-8 py-3 rounded bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
          >
            <IconDownload className="h-5 w-5" />
            Télécharger
          </button>
        )}

        {dl.status === "error" && (
          <button
            onClick={dl.retry}
            className="w-full px-8 py-3 rounded bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all"
          >
            Réessayer
          </button>
        )}

        {showSuccess && (
          <div className="space-y-2.5">
            <button
              onClick={() => dl.retry()}
              className="w-full px-8 py-3 rounded bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              <IconDownload className="h-5 w-5" />
              Télécharger à nouveau
            </button>
            <button
              onClick={onClose}
              className="w-full px-8 py-3 rounded bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-all"
            >
              Fermer
            </button>
          </div>
        )}

        {showError && (
          <button
            onClick={onClose}
            className="w-full px-8 py-3 rounded bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-all mt-2.5"
          >
            Fermer
          </button>
        )}

        {dl.status === "downloading" && (
          <button
            onClick={() => { dl.cancel(); onClose(); }}
            className="w-full px-8 py-3 rounded bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-all mt-3"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
