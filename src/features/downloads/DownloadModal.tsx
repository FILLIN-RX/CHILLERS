"use client";

import { useEffect, useRef, useState } from "react";
import { X, DownloadSimple, Check, Warning, Info, User } from "@phosphor-icons/react";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import { useDownload } from "@/hooks/useDownload";
import { useDownloadsStore } from "@/store/downloads";
import { useAuthStore } from "@/stores/useAuthStore";
import AuthModal from "@/components/AuthModal";
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
  initialLanguage?: "fr" | "vostfr";
}

const STATUS_LABEL: Record<DownloadStatus, string> = {
  queued: "En file d'attente",
  resolving: "Recherche du flux pour cette version…",
  ready: "Lien de téléchargement prêt",
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
  initialLanguage = "fr",
}: DownloadModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { translate: _ } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"fr" | "vostfr">(initialLanguage);

  useEffect(() => {
    if (isOpen) {
      setSelectedLang(initialLanguage);
    }
  }, [isOpen, initialLanguage]);

  const dl = useDownload({
    tmdbId: id,
    type: type === "movie" ? "movie" : "series",
    title,
    season,
    episodeNumber: episode,
    posterUrl,
    backdropUrl,
    language: selectedLang,
  });

  const activeCount = useDownloadsStore((s) =>
    s.tasks.filter(
      (t) => (t.status === "downloading" || t.status === "resolving") && t.id !== dl.task?.id
    ).length
  );

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

  // Auto-resolve: when opening or switching language, resolve if not already ready/downloading/done
  useEffect(() => {
    if (!isOpen || !user) return;
    if (dl.status !== "downloading" && dl.status !== "resolving" && dl.status !== "done" && dl.status !== "ready") {
      dl.retry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user, selectedLang]);

  if (!isOpen) return null;

  if (!user) {
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
          className="relative w-full max-w-md mx-4 bg-[#141414] rounded-2xl border border-white/10 shadow-2xl p-8 text-center"
        >
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#F42A7C]/15 border border-[#F42A7C]/25">
            <User className="h-8 w-8 text-[#F42A7C]" />
          </div>

          <h3 className="text-xl font-black text-white mb-2">Connexion requise</h3>
          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-6">
            Vous devez être connecté à votre compte CHILLERS pour télécharger des films ou séries. Le streaming reste accessible gratuitement sans compte.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              Se connecter
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white font-semibold text-sm transition-all cursor-pointer"
            >
              Continuer en streaming
            </button>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            setIsAuthModalOpen(false);
            onClose();
          }}
        />
      </div>
    );
  }

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
        className="relative w-full max-w-md mx-4 bg-[#141414] rounded-2xl border border-white/10 shadow-2xl p-6 sm:p-7 text-center"
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
          {showSpinner && (
            <svg className="animate-spin h-6 w-6 text-brand-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {showSuccess && (
            <div className="w-full h-full rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
          )}
          {showError && (
            <div className="w-full h-full rounded-full bg-red-500/20 flex items-center justify-center">
              <Warning className="h-6 w-6 text-red-400" />
            </div>
          )}
          {!showSpinner && !showSuccess && !showError && (
            <DownloadSimple className="h-6 w-6 text-white" />
          )}
        </div>

        <h3 className="text-lg sm:text-xl font-black text-white mb-1">{title}</h3>
        {episode != null && (
          <p className="text-zinc-400 text-xs sm:text-sm mb-4 font-medium">
            S{String(season ?? 1).padStart(2, "0")}E{String(episode).padStart(2, "0")}
          </p>
        )}

        {/* ── Language selection pills in Download Modal ── */}
        <div className="my-4 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-left">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Version à télécharger</span>
            <span className="text-[10px] text-zinc-400 font-normal">
              {selectedLang === initialLanguage ? "⚡ Déjà chargé" : "🔍 Nouvelle version"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={dl.status === "downloading"}
              onClick={() => setSelectedLang("fr")}
              className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                selectedLang === "fr"
                  ? "bg-brand-primary/20 border-brand-primary text-white shadow-sm ring-1 ring-brand-primary/40"
                  : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              } ${dl.status === "downloading" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="text-lg shrink-0">🇫🇷</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">Français</span>
                  {initialLanguage === "fr" && (
                    <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-white/10 text-zinc-300 shrink-0">
                      Actuel
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 truncate">VF</p>
              </div>
            </button>

            <button
              type="button"
              disabled={dl.status === "downloading"}
              onClick={() => setSelectedLang("vostfr")}
              className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                selectedLang === "vostfr"
                  ? "bg-brand-primary/20 border-brand-primary text-white shadow-sm ring-1 ring-brand-primary/40"
                  : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              } ${dl.status === "downloading" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="text-lg shrink-0">🌐</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">Originale</span>
                  {initialLanguage === "vostfr" && (
                    <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-white/10 text-zinc-300 shrink-0">
                      Actuel
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 truncate">VOSTFR</p>
              </div>
            </button>
          </div>
        </div>

        {activeCount > 0 && dl.status !== "downloading" && dl.status !== "done" && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs text-left flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <span>
              Un autre téléchargement est actuellement en cours. Votre fichier sera placé en file d'attente et démarrera automatiquement.
            </span>
          </div>
        )}

        <p className="text-zinc-400 text-xs sm:text-sm mb-5">
          {dl.error ? dl.error : STATUS_LABEL[dl.status]}
        </p>

        {dl.status === "ready" && (
          <button
            onClick={() => { dl.start(); onClose(); }}
            className="w-full px-8 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
          >
            <DownloadSimple className="h-5 w-5" />
            Télécharger ({selectedLang.toUpperCase()})
          </button>
        )}

        {dl.status === "error" && (
          <button
            onClick={dl.retry}
            className="w-full px-8 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all cursor-pointer"
          >
            Réessayer
          </button>
        )}

        {showSuccess && (
          <div className="space-y-2.5">
            <button
              onClick={() => dl.retry()}
              className="w-full px-8 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <DownloadSimple className="h-5 w-5" />
              Télécharger à nouveau
            </button>
            <button
              onClick={onClose}
              className="w-full px-8 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}

        {showError && (
          <button
            onClick={onClose}
            className="w-full px-8 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-all mt-2.5 cursor-pointer"
          >
            Fermer
          </button>
        )}

        {dl.status === "downloading" && (
          <button
            onClick={() => { dl.cancel(); onClose(); }}
            className="w-full px-8 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-all mt-3 cursor-pointer"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
