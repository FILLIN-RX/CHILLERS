"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  IconX,
  IconArrowLeft,
  IconLoader2,
  IconFolderOpen,
} from "@tabler/icons-react";
import type { DownloadTask } from "@/types/download";
import { formatTime } from "@/lib/format";
import { getOfflineVideoBlob, saveOfflineVideoBlob } from "@/services/offlineStorage";

interface OfflinePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: DownloadTask | null;
}

const SEEK_STEP_SECONDS = 10;
const VOLUME_STEP = 0.1;

export default function OfflinePlayerModal({
  isOpen,
  onClose,
  task,
}: OfflinePlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"main" | "speed">("main");
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const [centerFeedback, setCenterFeedback] = useState<{
    icon: "play" | "pause" | "forward" | "backward";
    key: number;
  } | null>(null);

  const triggerFeedback = useCallback(
    (icon: "play" | "pause" | "forward" | "backward") => {
      setCenterFeedback({ icon, key: Date.now() });
      setTimeout(() => setCenterFeedback(null), 600);
    },
    []
  );

  // ── Auto-load blob from IndexedDB ──
  useEffect(() => {
    if (!isOpen || !task) {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
        setVideoSrc(null);
      }
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    async function loadOfflineBlob() {
      if (!task) return;
      try {
        const blob = await getOfflineVideoBlob(task.id);
        if (isMounted && blob) {
          const url = URL.createObjectURL(blob);
          setVideoSrc(url);
          setIsLoading(false);

          const savedTime = localStorage.getItem(`offline_pos_${task.id}`);
          setTimeout(() => {
            if (!videoRef.current) return;
            if (savedTime) videoRef.current.currentTime = parseFloat(savedTime);
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
          }, 200);
          return;
        }
      } catch (err) {
        console.warn("[OfflinePlayer] Erreur chargement blob:", err);
      }
      if (isMounted) setIsLoading(false);
    }

    loadOfflineBlob();

    return () => { isMounted = false; };
  }, [isOpen, task?.id]);

  // Cleanup blob URL on close
  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  // Manual file fallback
  const handleManualFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && task) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      try {
        await saveOfflineVideoBlob(task.id, file, file.name, task.title);
      } catch {}
      setTimeout(() => {
        videoRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }, 200);
    }
  };

  // ── Playback controls ──
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      triggerFeedback("play");
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerFeedback("pause");
    }
  }, [triggerFeedback]);

  const seekTo = useCallback((time: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(time, duration));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const seekBy = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    triggerFeedback(seconds > 0 ? "forward" : "backward");
  }, [duration, triggerFeedback]);

  const changeVolume = useCallback((newVol: number) => {
    const v = Math.max(0, Math.min(1, newVol));
    setVolume(v);
    setIsMuted(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume || 1;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {}
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setShowSpeedMenu(false);
  }, []);

  // ── Controls auto-hide ──
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setControlsVisible(false);
        setShowSpeedMenu(false);
      }, 3000);
    }
  }, [isPlaying]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": case "j": e.preventDefault(); seekBy(-SEEK_STEP_SECONDS); break;
        case "ArrowRight": case "l": e.preventDefault(); seekBy(SEEK_STEP_SECONDS); break;
        case "ArrowUp": e.preventDefault(); changeVolume(volume + VOLUME_STEP); break;
        case "ArrowDown": e.preventDefault(); changeVolume(volume - VOLUME_STEP); break;
        case "f": e.preventDefault(); toggleFullscreen(); break;
        case "m": e.preventDefault(); toggleMute(); break;
        case "Escape": if (!document.fullscreenElement) onClose(); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, togglePlay, seekBy, changeVolume, volume, toggleFullscreen, toggleMute, onClose]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (!isOpen) return null;

  const episodeLabel =
    task?.season != null && task?.episodeNumber != null
      ? `S${String(task.season).padStart(2, "0")}E${String(task.episodeNumber).padStart(2, "0")}`
      : null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseDown={resetHideTimer}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center select-none overflow-hidden font-sans"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/x-matroska,video/webm,video/*"
        className="hidden"
        onChange={handleManualFile}
      />

      {/* ── LOADING ── */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-30">
          <IconLoader2 className="w-10 h-10 text-[#ff0000] animate-spin mb-4" />
          <p className="text-sm font-bold text-white">Chargement de la vidéo hors-ligne…</p>
        </div>
      )}

      {/* ── VIDEO ── */}
      {videoSrc ? (
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          onTimeUpdate={() => {
            if (videoRef.current) {
              const cur = videoRef.current.currentTime;
              setCurrentTime(cur);
              if (task) localStorage.setItem(`offline_pos_${task.id}`, String(cur));
              // Update buffered
              const buf = videoRef.current.buffered;
              if (buf.length > 0) {
                setBufferedPct((buf.end(buf.length - 1) / videoRef.current.duration) * 100);
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          playsInline
        />
      ) : !isLoading ? (
        /* ── FALLBACK: fichier non trouvé dans IndexedDB ── */
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-4 bg-zinc-900/90 border border-white/10 rounded-3xl shadow-2xl z-20">
          <div className="w-16 h-16 rounded-2xl bg-[#ff0000]/10 border border-[#ff0000]/25 text-[#ff0000] flex items-center justify-center mx-auto mb-4">
            <IconFolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white mb-1">Fichier introuvable en mémoire</h3>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Le fichier <span className="text-white font-bold">{task?.title}</span> ({task?.filename}) n&apos;est plus dans le cache. Sélectionnez-le manuellement depuis votre dossier de téléchargements.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-lg active:scale-95"
          >
            <IconFolderOpen className="w-4 h-4" />
            Ouvrir le fichier
          </button>
        </div>
      ) : null}

      {/* ── CENTER FEEDBACK ANIMATION ── */}
      {centerFeedback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            key={centerFeedback.key}
            className="p-5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white animate-ping-once"
          >
            {centerFeedback.icon === "play" && (
              <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white ml-1"><path d="M8 5v14l11-7z" /></svg>
            )}
            {centerFeedback.icon === "pause" && (
              <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            )}
            {centerFeedback.icon === "forward" && (
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>
                <span className="text-[10px] font-bold mt-0.5">+10s</span>
              </div>
            )}
            {centerFeedback.icon === "backward" && (
              <div className="flex flex-col items-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>
                <span className="text-[10px] font-bold mt-0.5">-10s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONTROLS OVERLAY (same design as VideoPlayer) ── */}
      {videoSrc && (
        <div
          className={`absolute inset-0 z-20 flex flex-col justify-between pointer-events-none transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* ── Top Bar ── */}
          <div className="pointer-events-auto flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={onClose}
                className="p-2 text-white hover:text-zinc-300 transition-opacity flex items-center justify-center"
                title="Retour (Esc)"
              >
                <IconArrowLeft className="w-6 h-6" />
              </button>
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-bold text-white drop-shadow truncate max-w-xs sm:max-w-md">
                    {task?.title || "Vidéo Hors-Ligne"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#ff0000] text-white text-[9px] font-black uppercase tracking-wider">
                    HORS-LIGNE
                  </span>
                </div>
                {episodeLabel && (
                  <span className="text-xs text-white/70 font-medium">{episodeLabel}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:text-zinc-300 transition-opacity flex items-center justify-center"
              aria-label="Fermer"
            >
              <IconX className="w-6 h-6" />
            </button>
          </div>

          {/* ── Center click zones ── */}
          <div className="flex-1 flex pointer-events-auto">
            <div
              className="w-1/4 h-full cursor-pointer"
              onClick={togglePlay}
              onDoubleClick={(e) => { e.stopPropagation(); seekBy(-10); }}
            />
            <div
              className="w-2/4 h-full cursor-pointer"
              onClick={togglePlay}
              onDoubleClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            />
            <div
              className="w-1/4 h-full cursor-pointer"
              onClick={togglePlay}
              onDoubleClick={(e) => { e.stopPropagation(); seekBy(10); }}
            />
          </div>

          {/* ── Bottom Control Bar (YouTube style, same as VideoPlayer) ── */}
          <div className="pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-2 px-3 sm:px-4 space-y-1">

            {/* ── 1. Timeline / Scrubber ── */}
            <div
              className="group/timeline relative w-full h-3 sm:h-4 flex items-end cursor-pointer select-none mb-1"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                seekTo(pct * duration);
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverPos(e.clientX - rect.left);
                setHoverTime(pct * duration);
              }}
              onMouseLeave={() => setHoverTime(null)}
            >
              {/* Timestamp tooltip */}
              {hoverTime !== null && (
                <div
                  className="absolute -top-7 px-2 py-0.5 rounded bg-black/85 text-white text-[11px] font-semibold tracking-wide pointer-events-none -translate-x-1/2 shadow z-30"
                  style={{ left: hoverPos }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}

              {/* Track */}
              <div className="relative w-full h-[3px] group-hover/timeline:h-[5px] transition-all duration-100 bg-white/20">
                {/* Buffered */}
                <div
                  className="absolute inset-y-0 left-0 bg-white/40 pointer-events-none transition-all duration-200"
                  style={{ width: `${bufferedPct}%` }}
                />
                {/* Played (Red) */}
                <div
                  className="absolute inset-y-0 left-0 bg-[#ff0000]"
                  style={{ width: `${progressPct}%` }}
                >
                  {/* Playhead thumb */}
                  <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#ff0000] scale-0 group-hover/timeline:scale-100 transition-transform duration-100 shadow" />
                </div>
              </div>
            </div>

            {/* ── 2. Controls Row ── */}
            <div className="flex items-center justify-between">
              {/* Left: Play, Volume, Time */}
              <div className="flex items-center gap-1 sm:gap-2">

                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-2 text-white hover:text-zinc-300 transition-opacity flex items-center justify-center"
                >
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>

                {/* Volume */}
                <div className="flex items-center group/vol relative">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-2 text-white hover:text-zinc-300 transition-opacity flex items-center justify-center"
                  >
                    {isMuted || volume === 0 ? (
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : volume < 0.5 ? (
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                        <path d="M7 9v6h4l5 5V4L7 9H3zm11.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>
                  {/* Expandable volume slider */}
                  <div className="overflow-hidden transition-all duration-200 w-0 group-hover/vol:w-14 sm:group-hover/vol:w-16 flex items-center ml-0.5">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => changeVolume(parseFloat(e.target.value))}
                      className="w-14 sm:w-16 h-1 accent-[#ff0000] cursor-pointer appearance-none rounded-full bg-white/30"
                    />
                  </div>
                </div>

                {/* Time */}
                <span className="text-[12px] sm:text-[13px] font-sans text-white/90 select-none ml-1 tabular-nums">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Right: Speed, PiP, Fullscreen */}
              <div className="flex items-center gap-0.5 sm:gap-1 relative">

                {/* Settings (Speed) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSpeedMenu(!showSpeedMenu);
                      setSettingsTab("main");
                    }}
                    className="p-2 text-white hover:text-zinc-300 transition-opacity flex items-center justify-center"
                  >
                    <svg viewBox="0 0 24 24" className={`w-6 h-6 fill-white transition-transform duration-300 ${showSpeedMenu ? "rotate-45" : ""}`}>
                      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                    </svg>
                  </button>

                  {/* Settings Popover */}
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-3 w-52 py-1.5 bg-[#1f1f1f]/95 backdrop-blur-md rounded-xl shadow-2xl text-white text-xs z-50 border border-white/10">
                      {settingsTab === "main" && (
                        <div className="flex flex-col">
                          <button
                            onClick={() => setSettingsTab("speed")}
                            className="px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
                          >
                            <span className="text-zinc-300">Vitesse de lecture</span>
                            <span className="text-zinc-400 font-medium">
                              {playbackRate === 1 ? "Normale" : `${playbackRate}x`} ›
                            </span>
                          </button>
                        </div>
                      )}
                      {settingsTab === "speed" && (
                        <div className="flex flex-col">
                          <button
                            onClick={() => setSettingsTab("main")}
                            className="px-4 py-2 flex items-center gap-2 text-zinc-400 hover:text-white border-b border-white/10 font-bold"
                          >
                            ‹ Vitesse de lecture
                          </button>
                          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                            <button
                              key={rate}
                              onClick={() => changePlaybackRate(rate)}
                              className={`px-4 py-2 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${
                                playbackRate === rate ? "text-[#ff0000] font-bold" : "text-white"
                              }`}
                            >
                              <span>{rate === 1 ? "Normale" : `${rate}`}</span>
                              {playbackRate === rate && <span>✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Picture-in-Picture */}
                <button
                  type="button"
                  onClick={togglePiP}
                  title="Image dans l'image"
                  className="p-2 text-white hover:text-zinc-300 transition-opacity flex items-center justify-center"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                    <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3C1.9 3 1 3.88 1 4.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" />
                  </svg>
                </button>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title="Plein écran (f)"
                  className="p-2 text-white hover:text-zinc-300 transition-opacity flex items-center justify-center"
                >
                  {isFullscreen ? (
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
