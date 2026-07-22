"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Episode } from "@/app/mockData";
import { checkSeriesDownloads, startDownload, triggerDownload } from "@/app/api";
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  FilmIcon,
  CheckIcon,
} from "@heroicons/react/24/solid";

interface EpisodeDownloadState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  seriesTitle: string;
  tmdbId: string;
  episodes: Episode[];
}

export default function SeriesDownloadModal({
  isOpen,
  onClose,
  seriesTitle,
  tmdbId,
  episodes,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<Record<string, EpisodeDownloadState>>({});
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const epKey = (ep: Episode) => `S${ep.season ?? 1}E${ep.number}`;

  const toggleEpisode = (ep: Episode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = epKey(ep);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    const availableKeys = episodes.map(epKey).filter((key) => links[key]?.url);
    if (selected.size === availableKeys.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(availableKeys));
    }
  };

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true);
    setLoadError(null);
    const initialState: Record<string, EpisodeDownloadState> = {};
    for (const ep of episodes) {
      initialState[epKey(ep)] = { url: null, loading: true, error: false };
    }
    setLinks(initialState);

    try {
      const result = await checkSeriesDownloads(tmdbId);
      const apiEpisodes = result?.data?.episodes || [];
      const updatedState: Record<string, EpisodeDownloadState> = {};
      const autoSelected = new Set<string>();

      for (const ep of episodes) {
        const key = epKey(ep);
        const apiEp = apiEpisodes.find(
          (a) => Number(a.season) === Number(ep.season ?? 1) && Number(a.episode) === Number(ep.number)
        );

        let dlUrl = apiEp?.downloadUrl ?? null;

        // Fallback: if checkSeriesDownloads didn't return a link for this ep, try startDownload directly
        if (!dlUrl) {
          try {
            const fallbackRes = await startDownload(tmdbId, 'series', seriesTitle, ep.season ?? 1, ep.number);
            if (fallbackRes?.downloadUrl) {
              dlUrl = fallbackRes.downloadUrl;
            }
          } catch {
            // silent fallback failure
          }
        }

        if (dlUrl) {
          updatedState[key] = { url: dlUrl, loading: false, error: false };
          autoSelected.add(key);
        } else {
          updatedState[key] = { url: null, loading: false, error: true };
        }
      }

      setLinks(updatedState);
      setSelected(autoSelected);
      setLinksLoaded(true);
    } catch (err) {
      console.error("Error loading episode download links:", err);
      setLoadError("Erreur lors de la récupération de certains liens.");
    } finally {
      setLoadingLinks(false);
    }
  }, [tmdbId, seriesTitle, episodes]);

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      setLinks({});
      setLinksLoaded(false);
      setLoadError(null);
      loadLinks();
    }
  }, [isOpen, loadLinks]);

  const downloadSelected = async () => {
    const toDownload = episodes.filter((ep) => {
      const key = epKey(ep);
      return selected.has(key) && links[key]?.url;
    });
    for (let i = 0; i < toDownload.length; i++) {
      const ep = toDownload[i];
      const url = links[epKey(ep)]?.url!;
      const filename = `${seriesTitle}-S${String(ep.season ?? 1).padStart(2, "0")}E${String(ep.number).padStart(2, "0")}.mp4`;
      triggerDownload(url, filename);
      if (i < toDownload.length - 1) await new Promise((r) => setTimeout(r, 700));
    }
  };

  const downloadSingle = (ep: Episode) => {
    const url = links[epKey(ep)]?.url;
    if (!url) return;
    const filename = `${seriesTitle}-S${String(ep.season ?? 1).padStart(2, "0")}E${String(ep.number).padStart(2, "0")}.mp4`;
    triggerDownload(url, filename);
  };

  const selectedWithLinks = episodes.filter((ep) => {
    const key = epKey(ep);
    return selected.has(key) && links[key]?.url;
  }).length;

  const availableCount = Object.values(links).filter((l) => l.url).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative z-10 w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-[#111113] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

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
                {linksLoaded && availableCount > 0 && (
                  <span className="text-emerald-400 ml-1.5">· {availableCount} disponible{availableCount > 1 ? "s" : ""}</span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 transition-colors">
              <XMarkIcon className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 mt-3">
            <button onClick={toggleAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-white/15 text-zinc-300 hover:bg-white/8 transition-colors">
              <div className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center transition-colors ${selected.size === episodes.length ? "bg-brand-primary border-brand-primary" : "border-zinc-500"}`}>
                {selected.size === episodes.length && <CheckIcon className="h-2.5 w-2.5 text-white" />}
              </div>
              {selected.size === episodes.length ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
            {selected.size > 0 && (
              <span className="text-zinc-500 text-xs">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
            )}
            <div className="flex-1" />
            {!linksLoaded ? (
              <button onClick={loadLinks} disabled={loadingLinks} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {loadingLinks ? (
                  <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Chargement…</>
                ) : (
                  <><ArrowDownTrayIcon className="h-3 w-3" />Charger les liens</>
                )}
              </button>
            ) : (
              <button onClick={downloadSelected} disabled={selectedWithLinks === 0} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowDownTrayIcon className="h-3 w-3" />Télécharger ({selectedWithLinks})
              </button>
            )}
          </div>

          {loadError && (
            <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{loadError}</p>
          )}
        </div>

        {/* Episode list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-3 space-y-1.5">
            {episodes.map((ep) => {
              const key = epKey(ep);
              const isSelected = selected.has(key);
              const linkState = links[key];
              const hasUrl = !!linkState?.url;
              const isLoading = !!linkState?.loading;
              const isError = !!linkState?.error && !isLoading;

              return (
                <div
                  key={key}
                  onClick={() => toggleEpisode(ep)}
                  className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? "bg-brand-primary/10 border-brand-primary/30" : "bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12"}`}
                >
                  {/* Checkbox */}
                  <div className={`flex-none w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? "bg-brand-primary border-brand-primary" : "border-zinc-600 group-hover:border-zinc-400"}`}>
                    {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                  </div>

                  {/* Thumbnail */}
                  <div className="flex-none w-20 aspect-video rounded-lg overflow-hidden bg-zinc-800/80 relative">
                    {ep.thumbnail ? (
                      <Image src={ep.thumbnail} alt={ep.title} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><FilmIcon className="h-4 w-4 text-zinc-600" /></div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-zinc-500 font-bold">{key}</span>
                      {isLoading && (
                        <svg className="animate-spin h-2.5 w-2.5 text-zinc-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {hasUrl && !isLoading && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      {isError && <span className="text-[9px] text-red-400 font-bold">Indisponible</span>}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white truncate">{ep.title}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{ep.duration}</p>
                  </div>

                  {/* Single download button */}
                  {hasUrl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadSingle(ep); }}
                      className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all"
                      title={`Télécharger ${key}`}
                    >
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none border-t border-white/8 px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {linksLoaded
              ? `${availableCount}/${episodes.length} lien${availableCount > 1 ? "s" : ""} disponible${availableCount > 1 ? "s" : ""}`
              : "Cliquez sur « Charger les liens » pour commencer"}
          </p>
          {linksLoaded && selectedWithLinks > 0 && (
            <button onClick={downloadSelected} className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-900/30">
              <ArrowDownTrayIcon className="h-4 w-4" />
              Télécharger {selectedWithLinks} épisode{selectedWithLinks > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
