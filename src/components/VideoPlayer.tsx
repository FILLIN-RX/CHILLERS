"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { MovieOrShow, Episode } from "@/app/mockData";
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  XMarkIcon,
  ListBulletIcon,
  ForwardIcon,
  BackwardIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  FilmIcon,
} from "@heroicons/react/24/solid";
import NotificationModal from "./NotificationModal";

interface VideoPlayerProps {
  item: MovieOrShow;
  episode?: Episode;
  onBack: () => void;
  onOpenDetails: (item: MovieOrShow) => void;
}

export default function VideoPlayer({ item, episode, onBack, onOpenDetails }: VideoPlayerProps) {
  const { translate: _ } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState("1080p");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isEpisodeDrawerOpen, setIsEpisodeDrawerOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [iframeActivated, setIframeActivated] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissPortraitPrompt, setDismissPortraitPrompt] = useState(false);

  // Use passed episode or none
  const currentEpisode = episode;

  // ─── EFFECTS ────────────────────────────────────────────────────────────────
  // Auto-hide controls logic
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && !isEpisodeDrawerOpen && !showSettings) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, isEpisodeDrawerOpen, showSettings]);

  useEffect(() => {
    const handleUserActivity = () => resetControlsTimeout();
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("touchstart", handleUserActivity);
    resetControlsTimeout();
    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("touchstart", handleUserActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsPortrait(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Load progress
  useEffect(() => {
    // Listener for VidLink progress events
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://vidlink.pro') return;
      
      if (event.data?.type === 'MEDIA_DATA') {
        const mediaData = event.data.data;
        localStorage.setItem('vidLinkProgress', JSON.stringify(mediaData));
      }
    };
    window.addEventListener('message', handleMessage);

    const key = `chiller_progress_${item.id}_${currentEpisode?.id || 'movie'}`;
    const saved = localStorage.getItem(key);
    if (saved && videoRef.current) {
      let parsed: { time: number };
      try { parsed = JSON.parse(saved); } catch (e) { return; }
      const handleMetadata = () => {
        if (videoRef.current) videoRef.current.currentTime = parsed.time;
      };
      videoRef.current.addEventListener("loadedmetadata", handleMetadata);
      return () => {
        videoRef.current?.removeEventListener("loadedmetadata", handleMetadata);
        window.removeEventListener("message", handleMessage);
      };
    }
    return () => window.removeEventListener("message", handleMessage);
  }, [item.id, currentEpisode?.id]);

  // Save progress
  useEffect(() => {
    if (currentTime > 0 && duration > 0) {
      const progressPercent = Math.min((currentTime / duration) * 100, 100);
      localStorage.setItem(`chiller_progress_${item.id}_${currentEpisode?.id || 'movie'}`, JSON.stringify({
        id: item.id,
        title: item.title,
        type: item.type,
        posterUrl: item.posterUrl,
        backdropUrl: item.backdropUrl,
        episodeId: currentEpisode?.id,
        time: currentTime,
        duration: duration,
        progress: progressPercent,
        remaining: `${Math.round((duration - currentTime) / 60)}m left`,
        episodeName: currentEpisode ? `E${currentEpisode.number}` : undefined,
        updatedAt: Date.now(),
      }));
    }
  }, [currentTime, duration, item.id, currentEpisode?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events that originate from inside iframes
      // (VidLink, YouTube, DoodStream, etc. handle their own keyboard input).
      if (e.target instanceof HTMLElement && e.target.tagName === "IFRAME") return;

      // Escape: only react if there's an open overlay or we are in
      // fullscreen. Otherwise the browser may fire a synthetic Escape
      // when an iframe takes focus or autoplay is rejected, which would
      // immediately call onBack() and pop the user out of the page.
      if (e.code === "Escape" && !isEpisodeDrawerOpen && !showSettings && !document.fullscreenElement) {
        return;
      }

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          handleSkip(-10);
          break;
        case "ArrowRight":
          handleSkip(10);
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        case "KeyM":
          toggleMute();
          break;
        case "Escape":
          if (isEpisodeDrawerOpen) setIsEpisodeDrawerOpen(false);
          else if (showSettings) setShowSettings(false);
          else if (document.fullscreenElement) toggleFullscreen();
          // Do not call onBack() on bare Escape — that caused the
          // auto-back bug. Users can still close the player with the X
          // button or by clicking outside.
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isEpisodeDrawerOpen, showSettings, isFullscreen]);

  // ─── HANDLERS ───────────────────────────────────────────────────────────────

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(console.error);
      setIsPlaying(!isPlaying);
    }
  };

  const handleSkip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const next = !isMuted;
      setIsMuted(next);
      videoRef.current.muted = next;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h > 0 ? h + ":" : ""}${m < 10 && h > 0 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Helper to determine if the video is an iframe (VidLink, YouTube, etc.)
  const isIframe = (item.videoUrl?.includes("vidlink.pro") || 
                    item.videoUrl?.includes("youtube.com") || 
                    item.videoUrl?.includes("doodstream.com") || 
                    item.videoUrl?.includes("doodstream.com/e/")) && 
                   !item.videoUrl?.includes("vidzy.cc") &&
                   !item.videoUrl?.includes("playmogo.com");
  
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { startDownload, triggerDownload } = await import('@/app/api');
      const type = item.type === 'series' && currentEpisode ? 'series' : 'movie';
      const title = item.title;
      const result = await startDownload(
        String(item.id),
        type,
        title,
        currentEpisode?.season ?? undefined,
        currentEpisode?.number
      );
      if (result?.downloadUrl) {
        triggerDownload(result.downloadUrl, `${title || 'video'}.mp4`);
      } else {
        setNotification({
          title: 'Téléchargement impossible',
          message: 'Aucune source de téléchargement trouvée pour ce contenu.',
        });
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`w-full min-h-[300px] sm:min-h-[400px] relative bg-black rounded-lg overflow-hidden transition-opacity duration-500 ${showControls ? "cursor-default" : "cursor-none"}`}
    >
      {/* ─── VIDEO / CONTENT ─────────────────────────────────────────────── */}
      {isIframe ? (
        <>
          <iframe
            key={item.videoUrl}
            src={item.videoUrl}
            className="absolute inset-0 w-full h-full border-none bg-black"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; gyroscope; accelerometer; clipboard-write"
            allowFullScreen
            referrerPolicy="origin"
            title={item.title}
            scrolling="no"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
          {!iframeActivated && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 cursor-pointer sm:hidden"
              onClick={() => setIframeActivated(true)}
            >
              <PlayIcon className="h-12 w-12 text-white/80" />
              <p className="text-sm font-bold text-white/70">Toucher pour lire</p>
            </div>
          )}
        </>
      ) : item.videoUrl ? (
        <video
          ref={videoRef}
          src={item.videoUrl}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          webkit-playsinline="true"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedData={() => setIsVideoLoading(false)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onWaiting={() => setIsVideoLoading(true)}
          onCanPlay={() => setIsVideoLoading(false)}
          onClick={handlePlayPause}
          onTouchEnd={(e) => {
            if (!showControls) {
              e.preventDefault();
              resetControlsTimeout();
            }
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
          <FilmIcon className="h-12 w-12 text-zinc-700" />
          <p className="font-medium text-lg">Flux indisponible</p>
          <p className="text-sm text-zinc-600 max-w-md text-center px-4">
            Aucun fournisseur n'a pu diffuser ce contenu.
            Le fichier est peut-être manquant sur DoodStream ou les sources alternatives sont indisponibles.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-full bg-[#D70466] text-white text-sm font-bold hover:bg-[#b5034f] transition-colors"
          >
            Retour
          </button>
        </div>
      )}

      {/* ─── Native Video Overlays ───────────────────────────────────────── */}
      {!isIframe && item.videoUrl && (
        <>
          {/* Loading Spinner */}
          {isVideoLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 z-20">
              <div className="animate-spin h-12 w-12 border-4 border-[#D70466] border-t-transparent rounded-full" />
              <p className="text-xs uppercase tracking-widest font-bold text-white/70">Chargement…</p>
            </div>
          )}

          {/* Play Overlay (shown when paused and not loading) */}
          {!isPlaying && !isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
              <button
                onClick={handlePlayPause}
                className="bg-white/20 backdrop-blur-md text-white p-6 rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-2xl"
                aria-label="Lire"
              >
                <PlayIcon className="h-12 w-12 translate-x-1" />
              </button>
            </div>
          )}

          {/* Portrait → Landscape prompt (mobile only) */}
          {isPortrait && !dismissPortraitPrompt && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/80 sm:hidden">
              <button
                onClick={() => setDismissPortraitPrompt(true)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-10"
                aria-label="Fermer"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
              <svg className="h-16 w-16 text-white/60 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="12" y1="18" x2="12" y2="18.01" />
              </svg>
              <p className="text-white/80 text-base font-bold text-center px-8">
                Tourne ton téléphone
              </p>
              <p className="text-white/50 text-sm text-center px-8 max-w-xs">
                Mode paysage recommandé pour la meilleure expérience
              </p>
            </div>
          )}

          {/* Gradient Shadows */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none transition-opacity duration-500 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`} />

          {/* TOP BAR */}
          <div className={`absolute top-0 inset-x-0 p-6 flex items-start justify-between transition-all duration-500 transform ${showControls || !isPlaying ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}`}>
            {/* Close button (mobile: top-left, desktop: part of right section) */}
            <button
              onClick={onBack}
              aria-label="Fermer le lecteur"
              className="p-2 rounded-full hover:bg-white/10 text-white transition-all transform hover:rotate-90 sm:hidden"
            >
              <XMarkIcon className="h-7 w-7" />
            </button>

            {/* Branding & metadata (hidden on mobile) */}
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-3">
                <span className="text-[#D70466] font-black tracking-tighter text-xl">CHILLERS+</span>
                <div className="h-4 w-[1px] bg-white/20" />
                <h1 className="text-white font-bold text-lg flex items-center gap-2">
                  {item.title}
                  {currentEpisode && (
                    <>
                      <ChevronRightIcon className="h-4 w-4 text-white/40" />
                      <span className="text-white/80">E{currentEpisode.number} - {currentEpisode.title}</span>
                    </>
                  )}
                </h1>
              </div>
              <p className="text-white/50 text-xs font-medium mt-1 uppercase tracking-widest">
                {item.genres.join(" • ")}
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-6">
              {/* Volume */}
              <div className="flex items-center gap-3 group/vol">
                <button onClick={toggleMute} aria-label={isMuted || volume === 0 ? "Activer le son" : "Couper le son"} className="text-white hover:text-[#D70466] transition-colors">
                  {isMuted || volume === 0 ? <SpeakerXMarkIcon className="h-6 w-6" /> : <SpeakerWaveIcon className="h-6 w-6" />}
                </button>
                <input 
                  type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (videoRef.current) videoRef.current.volume = v;
                    setIsMuted(v === 0);
                  }}
                  className="w-0 group-hover/vol:w-24 transition-all duration-300 h-1 bg-white/20 appearance-none rounded-full accent-[#D70466]"
                />
              </div>

              {/* Exit */}
              <button 
                onClick={onBack}
                aria-label="Fermer le lecteur"
                className="p-2 rounded-full hover:bg-white/10 text-white transition-all transform hover:rotate-90"
              >
                <XMarkIcon className="h-7 w-7" />
              </button>
            </div>
          </div>

          {/* BOTTOM BAR */}
          <div className={`absolute bottom-0 inset-x-0 transition-all duration-500 transform ${showControls || !isPlaying ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
            
            {/* Timeline */}
            <div className="px-6 group/timeline relative">
              <input 
                type="range" min="0" max={duration || 100} value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 group-hover/timeline:h-2 bg-white/20 appearance-none cursor-pointer rounded-full accent-[#D70466] transition-all"
              />
              <div className="flex justify-between mt-2 text-[10px] font-bold text-white/60 uppercase tracking-widest">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="p-6 pt-2 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <button onClick={() => handleSkip(-10)} aria-label="Reculer de 10 secondes" className="text-white/70 hover:text-white transition-colors">
                  <BackwardIcon className="h-7 w-7" />
                </button>
                <button onClick={handlePlayPause} aria-label={isPlaying ? "Mettre en pause" : "Lire"} className="bg-white text-black p-4 rounded-full hover:scale-110 transition-transform shadow-xl">
                  {isPlaying ? <PauseIcon className="h-8 w-8" /> : <PlayIcon className="h-8 w-8 translate-x-0.5" />}
                </button>
                <button onClick={() => handleSkip(10)} aria-label="Avancer de 10 secondes" className="text-white/70 hover:text-white transition-colors">
                  <ForwardIcon className="h-7 w-7" />
                </button>
              </div>

              <div className="flex items-center gap-6">
                <button 
                  onClick={handleDownload}
                  disabled={downloading}
                  aria-label={downloading ? _("download.preparing") : _("download.single")}
                  className={`text-white transition-colors ${downloading ? "opacity-70" : "hover:text-[#D70466]"}`}
                >
                  {downloading ? (
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <ArrowDownTrayIcon className="h-6 w-6" />
                  )}
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label="Paramètres"
                  className={`text-white transition-colors ${showSettings ? "text-[#D70466]" : "hover:text-[#D70466]"}`}
                >
                  <Cog6ToothIcon className="h-6 w-6" />
                </button>
                <button onClick={toggleFullscreen} aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"} className="text-white hover:text-[#D70466] transition-colors">
                  {isFullscreen ? <ArrowsPointingInIcon className="h-6 w-6" /> : <ArrowsPointingOutIcon className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>

          {/* ─── FLOATING MENUS ────────────────────────────────────────────── */}

          {/* Settings Menu */}
          {showSettings && (
            <div className="absolute bottom-24 right-6 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 z-[100] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-6">
                <div>
                  <label className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3 block">Playback Speed</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[0.5, 1, 1.5, 2].map((s) => (
                      <button 
                        key={s} onClick={() => {
                          setPlaybackSpeed(s);
                          if (videoRef.current) videoRef.current.playbackRate = s;
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${playbackSpeed === s ? "bg-[#D70466] text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3 block">Quality</label>
                  <div className="flex flex-col gap-2">
                    {["1080p", "720p", "Auto"].map((q) => (
                      <button 
                        key={q} onClick={() => setQuality(q)}
                        className={`w-full text-left px-4 py-2 rounded-xl text-xs font-bold transition-all ${quality === q ? "bg-[#D70466]/20 text-[#D70466]" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {notification && (
        <NotificationModal
          isOpen={!!notification}
          onClose={() => setNotification(null)}
          title={notification.title}
          message={notification.message}
        />
      )}
    </div>
  );
}
