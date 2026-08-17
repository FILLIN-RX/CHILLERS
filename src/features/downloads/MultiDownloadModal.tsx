"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  IconX,
  IconDownload,
  IconMovie,
  IconAlertTriangle,
  IconCheck,
} from "@tabler/icons-react";
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import { useDownloadsBatch } from "@/hooks/useDownloadsBatch";
import { useLanguage } from "@/i18n/LanguageContext";
import { downloadTaskId } from "@/lib/format";
import type { Episode } from "@/types/media";
import DownloadProgressBar from "./DownloadProgressBar";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  seriesTitle: string;
  tmdbId: string;
  episodes: Episode[];
}

const epKey = (ep: Episode) => `S${ep.season ?? 1}E${ep.number}`;

export default function MultiDownloadModal({
  isOpen,
  onClose,
  seriesTitle,
  tmdbId,
  episodes,
}: Props) {
  const { translate: _ } = useLanguage();
  const [started, setStarted] = useState(false);

  const batch = useDownloadsBatch({
    tmdbId,
    seriesTitle,
    type: "series",
    episodes,
    gated: !started,
  });

  // Scroll lock + ESC.
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

  if (!isOpen) return null;

  const { totals, tasks } = batch;
  const taskByKey = new Map(
    tasks.map((t) => [
      downloadTaskId({ tmdbId: t.tmdbId, season: t.season, episodeNumber: t.episodeNumber }),
      t,
    ]),
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg mx-4 bg-[#141414] rounded-md sm:rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex-none px-5 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-0.5">
                Téléchargement · {episodes.length} épisode{episodes.length > 1 ? "s" : ""}
              </p>
              <h2 className="text-lg font-black text-white truncate">{seriesTitle}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {!started ? (
                  <span>
                    {totals.ready > 0 && (
                      <span className="text-emerald-400">
                        {totals.ready} prêt{totals.ready > 1 ? "s" : ""}
                      </span>
                    )}
                    {totals.ready > 0 && totals.failed > 0 && " · "}
                    {totals.failed > 0 && (
                      <span className="text-rose-400">{totals.failed} indisponible{totals.failed > 1 ? "s" : ""}</span>
                    )}
                    {totals.ready === 0 && totals.failed === 0 && (
                      <span>Récupération des liens…</span>
                    )}
                  </span>
                ) : totals.running > 0 || totals.queued > 0 ? (
                  <span>
                    {totals.running > 0 && (
                      <span className="text-brand-primary">{totals.running} en cours</span>
                    )}
                    {totals.running > 0 && totals.queued > 0 && " · "}
                    {totals.queued > 0 && <span>{totals.queued} en attente</span>}
                  </span>
                ) : (
                  <span>
                    <span className="text-emerald-400">{totals.done} terminé{totals.done > 1 ? "s" : ""}</span>
                    {totals.failed > 0 && (
                      <span className="text-rose-400 ml-1.5">· {totals.failed} en erreur</span>
                    )}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 transition-colors"
              aria-label="Fermer"
            >
              <IconX className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[55vh] overflow-y-auto overscroll-contain p-3 space-y-1.5">
          {episodes.map((ep) => {
            const id = downloadTaskId({
              tmdbId,
              season: ep.season,
              episodeNumber: ep.number,
            });
            const task = taskByKey.get(id);
            const status = task?.status ?? "queued";

            return (
              <div
                key={epKey(ep)}
                className={`rounded-xl border p-3 transition-all ${
                  status === "done"
                    ? "bg-emerald-500/8 border-emerald-500/25"
                    : status === "error"
                    ? "bg-red-500/5 border-red-500/15"
                    : "bg-white/3 border-white/6"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-none w-16 aspect-video rounded-lg overflow-hidden bg-zinc-800/80 relative">
                    {ep.thumbnail ? (
                      <Image
                        src={ep.thumbnail}
                        alt={ep.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <IconMovie className="h-4 w-4 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-zinc-500 font-bold">
                        {epKey(ep)}
                      </span>
                      {status === "done" && (
                        <span className="text-[10px] text-emerald-400 font-bold">Terminé</span>
                      )}
                      {status === "downloading" && (
                        <span className="text-[10px] text-brand-primary font-bold">En cours</span>
                      )}
                      {status === "error" && (
                        <span className="text-[10px] text-red-400 font-bold">Indisponible</span>
                      )}
                      {status === "canceled" && (
                        <span className="text-[10px] text-zinc-500 font-bold">Annulé</span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white truncate">
                      {ep.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{ep.duration}</p>
                  </div>

                  <div className="flex-none flex items-center gap-1">
                    {(status === "queued" || status === "resolving") && (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <svg
                          className="animate-spin h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </span>
                    )}
                    {status === "ready" && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-3 py-1">
                        <IconCheck className="h-3 w-3" />Prêt
                      </span>
                    )}
                    {status === "done" && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1">
                        <IconCheck className="h-3 w-3" />Terminé
                      </span>
                    )}
                    {status === "error" && (
                      <button
                        onClick={() => batch.retryOne(id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-full px-3 py-1 hover:bg-rose-500/15"
                      >
                        <IconAlertTriangle className="h-3 w-3" />Réessayer
                      </button>
                    )}
                    {(status === "downloading" || status === "queued" || status === "resolving") && (
                      <button
                        onClick={() => batch.cancelOne(id)}
                        className="text-[10px] text-zinc-400 hover:text-white underline"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                {(status === "downloading" || (status === "done" && task)) && (
                  <div className="mt-2">
                    <DownloadProgressBar
                      bytesDownloaded={task?.bytesDownloaded ?? 0}
                      totalBytes={task?.totalBytes ?? null}
                      status={status}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-white/8 px-5 py-4 flex items-center gap-2">
          {!started ? (
            <button
              onClick={() => setStarted(true)}
              disabled={totals.ready === 0}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded font-bold text-sm bg-white text-black hover:bg-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            >
              <IconDownload className="h-4 w-4" />
              {totals.ready > 0
                ? `Télécharger ${totals.ready} épisode${totals.ready > 1 ? "s" : ""}`
                : "Préparation des liens…"}
            </button>
          ) : (
            <>
              {totals.running > 0 && (
                <button
                  onClick={batch.cancelAll}
                  className="flex-1 px-4 py-3 rounded font-bold text-sm bg-zinc-800 text-white hover:bg-zinc-700 transition-all"
                >
                  Tout arrêter
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded font-bold text-sm bg-white text-black hover:bg-zinc-200 transition-all shadow-lg"
              >
                <IconDownload className="h-4 w-4" />
                {totals.done === totals.total && totals.total > 0
                  ? "Tous terminés"
                  : totals.running > 0
                  ? `Téléchargement…`
                  : `${totals.done}/${totals.total}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
