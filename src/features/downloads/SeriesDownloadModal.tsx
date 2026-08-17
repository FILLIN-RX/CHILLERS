"use client";

import { useState } from "react";
import Image from "next/image";
import { IconX, IconDownload, IconMovie, IconCheck } from "@tabler/icons-react";
import type { Episode } from "@/types/media";
import { downloadTaskId } from "@/lib/format";
import MultiDownloadModal from "./MultiDownloadModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  seriesTitle: string;
  tmdbId: string;
  episodes: Episode[];
}

const epKey = (ep: Episode) => `S${ep.season ?? 1}E${ep.number}`;

export default function SeriesDownloadModal({
  isOpen,
  onClose,
  seriesTitle,
  tmdbId,
  episodes,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [multiOpen, setMultiOpen] = useState(false);
  const [multiEpisodes, setMultiEpisodes] = useState<Episode[]>([]);
  // Changes on every open of the link modal so MultiDownloadModal remounts
  // with a fresh "Télécharger" gate (avoids resetting state in an effect).
  const [multiKey, setMultiKey] = useState(0);

  const handleClose = () => {
    setMultiOpen(false);
    setMultiEpisodes([]);
    setSelected(new Set());
    onClose();
  };

  const toggleEpisode = (ep: Episode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = downloadTaskId({
        tmdbId,
        season: ep.season,
        episodeNumber: ep.number,
      });
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === episodes.length) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(
          episodes.map((ep) =>
            downloadTaskId({
              tmdbId,
              season: ep.season,
              episodeNumber: ep.number,
            }),
          ),
        ),
      );
    }
  };

  const openDownload = (eps: Episode[]) => {
    setMultiEpisodes(eps);
    setMultiKey((k) => k + 1);
    setMultiOpen(true);
  };

  const downloadSelected = () => {
    openDownload(
      episodes.filter((ep) =>
        selected.has(
          downloadTaskId({
            tmdbId,
            season: ep.season,
            episodeNumber: ep.number,
          }),
        ),
      ),
    );
  };

  const downloadSingle = (ep: Episode) => {
    openDownload([ep]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#141414] rounded-t-md sm:rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex-none px-5 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-0.5">
                Téléchargement · Série
              </p>
              <h2 className="text-lg font-black text-white truncate">{seriesTitle}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {episodes.length} épisode{episodes.length > 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 transition-colors"
              aria-label="Fermer"
            >
              <IconX className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-white/15 text-zinc-300 hover:bg-white/8 transition-colors"
            >
              <div
                className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center transition-colors ${
                  selected.size === episodes.length
                    ? "bg-brand-primary border-brand-primary"
                    : "border-zinc-500"
                }`}
              >
                {selected.size === episodes.length && (
                  <IconCheck className="h-2.5 w-2.5 text-white" />
                )}
              </div>
              {selected.size === episodes.length
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
            {selected.size > 0 && (
              <span className="text-zinc-500 text-xs">
                {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={downloadSelected}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold bg-white text-black hover:bg-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconDownload className="h-3 w-3" />
              Télécharger ({selected.size})
            </button>
          </div>
        </div>

        {/* Episode list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-3 space-y-1.5">
            {episodes.map((ep) => {
              const key = downloadTaskId({
                tmdbId,
                season: ep.season,
                episodeNumber: ep.number,
              });
              const isSelected = selected.has(key);

              return (
                <div
                  key={key}
                  onClick={() => toggleEpisode(ep)}
                  className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-brand-primary/10 border-brand-primary/30"
                      : "bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`flex-none w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-brand-primary border-brand-primary"
                        : "border-zinc-600 group-hover:border-zinc-400"
                    }`}
                  >
                    {isSelected && <IconCheck className="h-3 w-3 text-white" />}
                  </div>

                  {/* Thumbnail */}
                  <div className="flex-none w-20 aspect-video rounded-lg overflow-hidden bg-zinc-800/80 relative">
                    {ep.thumbnail ? (
                      <Image
                        src={ep.thumbnail}
                        alt={ep.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <IconMovie className="h-4 w-4 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-zinc-500 font-bold">
                        {epKey(ep)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white truncate">
                      {ep.title}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{ep.duration}</p>
                  </div>

                  {/* Single download button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSingle(ep);
                    }}
                    className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all"
                    title={`Télécharger ${epKey(ep)}`}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-white/8 px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {selected.size === 0
              ? "Sélectionnez des épisodes puis cliquez sur Télécharger"
              : `${selected.size} épisode${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}`}
          </p>
          <button
            onClick={downloadSelected}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-5 py-2 rounded font-bold text-sm bg-white text-black hover:bg-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          >
            <IconDownload className="h-4 w-4" />
            Télécharger {selected.size} épisode{selected.size > 1 ? "s" : ""}
          </button>
        </div>
      </div>

      <MultiDownloadModal
        key={multiKey}
        isOpen={multiOpen}
        onClose={() => setMultiOpen(false)}
        seriesTitle={seriesTitle}
        tmdbId={tmdbId}
        episodes={multiEpisodes}
      />
    </div>
  );
}
