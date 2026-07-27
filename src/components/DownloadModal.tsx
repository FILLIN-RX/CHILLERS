"use client";

import React, { useState, useEffect, useRef } from "react";
import { IconX, IconDownload, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { acquireModalScrollLock, releaseModalScrollLock } from "@/lib/modalScrollLock";
import { startDownload, triggerDownload } from "@/app/api";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  id: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
}

type Status = 'loading' | 'ready' | 'success' | 'error';

export default function DownloadModal({
  isOpen,
  onClose,
  title,
  id,
  type,
  season,
  episode,
}: DownloadModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    acquireModalScrollLock();
    return () => releaseModalScrollLock();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setStatus('loading');
    setDownloadUrl(null);
    setErrorMsg("");

    let cancelled = false;
    (async () => {
      try {
        const result = await startDownload(id, type, title, season, episode);
        if (cancelled) return;
        if (result?.downloadUrl) {
          setDownloadUrl(result.downloadUrl);
          setStatus('ready');
        } else {
          setErrorMsg("Lien ou film indisponible");
          setStatus('error');
        }
      } catch {
        if (!cancelled) {
          setErrorMsg("Lien ou film indisponible");
          setStatus('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, id, type, title, season, episode]);

  const handleDownloadClick = () => {
    if (!downloadUrl) return;
    const filename = `${title}${episode ? `-S${season ?? 1}E${episode}` : ""}.mp4`;
    triggerDownload(downloadUrl, filename);
    setStatus('success');
  };

  const handleClose = () => {
    if (status === 'success') onClose();
    else onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md mx-4 bg-brand-card rounded-3xl border border-brand-border glass-modal p-8 text-center"
      >
        <button
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <IconX className="h-5 w-5" />
        </button>

        <div className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-white/10">
          {status === 'loading' && (
            <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {status === 'ready' && <IconDownload className="h-7 w-7 text-white" />}
          {status === 'success' && (
            <div className="w-full h-full rounded-full bg-emerald-500/20 flex items-center justify-center">
              <IconCheck className="h-7 w-7 text-emerald-400" />
            </div>
          )}
          {status === 'error' && (
            <div className="w-full h-full rounded-full bg-red-500/20 flex items-center justify-center">
              <IconAlertTriangle className="h-7 w-7 text-red-400" />
            </div>
          )}
        </div>

        <h3 className="text-xl font-black text-white mb-1">{title}</h3>
        {episode && (
          <p className="text-zinc-400 text-sm mb-4">
            S{String(season ?? 1).padStart(2, "0")}E{String(episode).padStart(2, "0")}
          </p>
        )}

        {status === 'loading' && (
          <p className="text-zinc-400 text-sm mb-6">Recherche du lien de téléchargement…</p>
        )}

        {status === 'ready' && (
          <p className="text-zinc-400 text-sm mb-6">Lien trouvé, clique sur Télécharger pour lancer le téléchargement.</p>
        )}

        {status === 'success' && (
          <p className="text-emerald-400 text-sm mb-6 font-semibold">Téléchargement réussi</p>
        )}

        {status === 'error' && (
          <p className="text-red-400 text-sm mb-6">{errorMsg}</p>
        )}

        {status === 'ready' && (
          <button
            onClick={handleDownloadClick}
            className="w-full px-8 py-3 rounded-full bg-brand-primary text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <IconDownload className="h-4 w-4" />
            Télécharger
          </button>
        )}

        {(status === 'success' || status === 'error') && (
          <button
            onClick={handleClose}
            className="w-full px-8 py-3 rounded-full bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-all"
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
