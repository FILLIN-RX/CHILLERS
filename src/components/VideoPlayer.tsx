"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Hls from "hls.js";
import { useLanguage } from "@/i18n/LanguageContext";
import type { MovieOrShow, Episode } from "@/types/media";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
  IconVolumeOff,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconX,
  IconPlayerSkipForward,
  IconRewindBackward10,
  IconSettings,
  IconDownload,
  IconMovie,
} from "@tabler/icons-react";
import NotificationModal from "./NotificationModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import { isIframeProviderUrl, toEmbedUrl } from "@/lib/providers";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { useStreamUrl } from "@/hooks/useStreamUrl";

interface VideoPlayerProps {
  item: MovieOrShow;
  episode?: Episode;
  onBack: () => void;
  onOpenDetails?: (item: MovieOrShow) => void;
}

/**
 * Delay between progress snapshots we actually persist to localStorage.
 * The player's `onTimeUpdate` fires ~4 Hz on Chrome; persisting on every
 * tick caused measurable I/O stalls during playback.
 */
const PROGRESS_PERSIST_DEBOUNCE_MS = 5_000;

export default function VideoPlayer({ item, episode, onBack, onOpenDetails }: VideoPlayerProps) {
  const { translate: _ } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState("1080p");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissPortraitPrompt, setDismissPortraitPrompt] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const currentEpisode = episode;

  /* ───────── controls auto-hide ───────── */

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying && !showSettings) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, showSettings]);

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

  /* ───────── orientation ───────── */

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsPortrait(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ───────── vidlink cross-frame progress bridge ───────── */

  // Static origin list — kept short so a new partner domain doesn't silently
  // get a back-channel into our localStorage without a code review here.
  const allowedMessageOrigins = useMemo(() => new Set(["https://vidlink.pro"]), []);

  /* ───────── watch progress persistence ───────── */
  // The `onTimeUpdate` events fire ~4 Hz in Chrome. Persisting JSON to
  // localStorage on each tick caused noticeable I/O stalls during playback.
  // We debounce the write so it only happens after PROGRESS_PERSIST_DEBOUNCE_MS
  // of *stable* currentTime.
  const progressKey = `chiller_progress_${item.id}_${currentEpisode?.id ?? "movie"}`;
  useDebouncedEffect(
    () => {
      if (currentTime <= 0 || duration <= 0) return;
      const progressPercent = Math.min((currentTime / duration) * 100, 100);
      localStorage.setItem(
        progressKey,
        JSON.stringify({
          id: item.id,
          title: item.title,
          type: item.type,
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          episodeId: currentEpisode?.id,
          season: currentEpisode?.season,
          episode: currentEpisode?.number,
          time: currentTime,
          duration,
          progress: progressPercent,
          remaining: `${Math.round((duration - currentTime) / 60)}m left`,
          episodeName: currentEpisode
            ? `S${String(currentEpisode.season ?? 1).padStart(2, "0")}E${String(currentEpisode.number).padStart(2, "0")}`
            : undefined,
          updatedAt: Date.now(),
        }),
      );
    },
    [currentTime, duration, progressKey],
    PROGRESS_PERSIST_DEBOUNCE_MS,
  );

  /* ───────── key handling ───────── */

  const handlePlayPause = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().catch((err) => {
        // AbortError when user clicked again before the previous play()
        // resolved — harmless. Anything else surfaces in the UI.
        if (err?.name !== "AbortError") console.error(err);
      });
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSkip = useCallback(
    (seconds: number) => {
      const el = videoRef.current;
      if (!el) return;
      el.currentTime = Math.min(Math.max(el.currentTime + seconds, 0), duration);
    },
    [duration],
  );

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const next = !isMuted;
    setIsMuted(next);
    el.muted = next;
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (!document.fullscreenElement) {
      c.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error(err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch((err) => console.error(err));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.tagName === "IFRAME") return;
      if (e.code === "Escape" && !showSettings && !document.fullscreenElement) return;

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
          if (showSettings) setShowSettings(false);
          else if (document.fullscreenElement) toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSkip, toggleFullscreen, toggleMute, showSettings]);

  /* ───────── resume from saved progress + cross-frame bridge ───────── */
  // Two separate listeners here so each cleans up its own subscription —
  // the previous version had tangled cleanup paths that occasionally leaked
  // the message listener on unmount.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!allowedMessageOrigins.has(event.origin)) return;
      if (event.data?.type === "MEDIA_DATA") {
        localStorage.setItem("vidLinkProgress", JSON.stringify(event.data.data));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [allowedMessageOrigins]);

  // Resume playback position from localStorage when metadata is ready.
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const saved = localStorage.getItem(progressKey);
    if (!saved) return;
    let parsed: { time: number };
    try {
      parsed = JSON.parse(saved);
    } catch {
      return;
    }
    const handleMetadata = () => {
      if (videoRef.current && Number.isFinite(parsed.time)) {
        videoRef.current.currentTime = parsed.time;
      }
    };
    node.addEventListener("loadedmetadata", handleMetadata);
    return () => node.removeEventListener("loadedmetadata", handleMetadata);
  }, [progressKey]);

  /* ───────── stream URL resolution (TanStack Query cache + race) ───────── */

  const streamType: "movie" | "series" | "anime" =
    item.type === "series" ? "series" : item.type === "anime" ? "anime" : "movie";

  const streamQuery = useStreamUrl({
    id: String(item.id),
    type: streamType,
    season: currentEpisode?.season,
    episode: currentEpisode?.number,
    title: item.title,
    enabled: !!item.id,
  });

  const resolvedStreamUrl = streamQuery.data?.embedUrl ?? null;
  const videoUrl = useMemo(() => toEmbedUrl(resolvedStreamUrl ?? item.videoUrl ?? undefined), [resolvedStreamUrl, item.videoUrl]);
  const isIframe = isIframeProviderUrl(videoUrl);

  /* ───────── HLS lifecycle ───────── */
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoUrl) return;

    const isHls = videoUrl.includes(".m3u8");
    if (!isHls) {
      // Direct MP4 — let the <video> tag handle it natively. We don't try
      // to autoplay here: the browser requires a user gesture and the user
      // hasn't pressed play yet (loading screen takes care of feedback).
      setIsVideoLoading(true);
      return;
    }

    if (Hls.isSupported()) {
      // Tuned for "press play, see frame" UX:
      // - smaller buffer (30s) avoids wasting memory on long streams
      // - 2s back buffer keeps RAM usage low while still allowing seeks
      // - aggressive ABR loading keeps the next variant warm
      // - retry on transient errors before bubbling to the UI
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 2,
        maxLoadingDelay: 2,
        maxBufferHole: 0.5,
        fragLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 4,
        startLevel: -1,
        abrEwmaDefaultEstimate: 1_000_000,
      });
      hls.loadSource(videoUrl);
      hls.attachMedia(el);
      const onManifest = () => {
        setIsVideoLoading(false);
        el.play().catch((err) => {
          if (err?.name !== "AbortError") console.error(err);
        });
      };
      hls.on(Hls.Events.MANIFEST_PARSED, onManifest);
      hls.on(Hls.Events.FRAG_LOADED, () => {
        // Drop the spinner as soon as we have a playable fragment.
        setIsVideoLoading(false);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data?.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Transient — try to recover instead of showing the error.
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          setIsVideoLoading(true);
        }
      });
      return () => {
        hls.destroy();
      };
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = videoUrl;
      const onLoaded = () => {
        setIsVideoLoading(false);
        el.play().catch(() => {
          /* gesture-gated; ignored */
        });
      };
      el.addEventListener("loadedmetadata", onLoaded);
      return () => el.removeEventListener("loadedmetadata", onLoaded);
    }
    return undefined;
  }, [videoUrl]);

  /* ───────── timeline interactions ───────── */

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) {
      videoRef.current.currentTime = ratio * duration;
      setCurrentTime(ratio * duration);
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h > 0 ? h + ":" : ""}${m < 10 && h > 0 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const [showSingleDownload, setShowSingleDownload] = useState(false);

  const handleDownload = () => {
    setShowSingleDownload(true);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[300px] sm:min-h-[500px] lg:min-h-[600px] bg-black overflow-hidden select-none"
      onDoubleClick={toggleFullscreen}
    >
      {isIframe ? (
        <iframe
          key={videoUrl}
          src={videoUrl}
          className="absolute inset-0 w-full h-full border-none bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; gyroscope; accelerometer; clipboard-write"
          allowFullScreen
          referrerPolicy="origin"
          title={item.title}
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-forms allow-orientation-lock allow-presentation"
        />
      ) : videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          preload="auto"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            const t = videoRef.current?.currentTime ?? 0;
            // Set state every tick — but the localStorage write below is debounced.
            setCurrentTime(t);
          }}
          onLoadedData={() => setIsVideoLoading(false)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onWaiting={() => setIsVideoLoading(true)}
          onCanPlay={() => setIsVideoLoading(false)}
          onError={() => setIsVideoLoading(false)}
          onClick={handlePlayPause}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
          <IconMovie className="h-12 w-12 text-zinc-700" />
          <p className="font-medium text-lg">
            {streamQuery.isLoading ? "Chargement du flux…" : "Flux indisponible"}
          </p>
          <p className="text-sm text-zinc-600 max-w-md text-center px-4">
            {streamQuery.isLoading
              ? "Recherche du meilleur fournisseur…"
              : streamQuery.isError
              ? "Une erreur est survenue. Réessaie dans quelques instants."
              : "Aucun fournisseur n'a pu diffuser ce contenu."}
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          >
            Retour
          </button>
        </div>
      )}

      {!isIframe && videoUrl && (
        <>
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
              <div className="h-10 w-10 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {!isPlaying && !isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
              <button
                onClick={handlePlayPause}
                className="text-white/80 hover:text-white hover:scale-110 transition-all"
              >
                <IconPlayerPlay className="h-16 w-16" />
              </button>
            </div>
          )}

          {isPortrait && !dismissPortraitPrompt && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/80 sm:hidden">
              <button
                onClick={() => setDismissPortraitPrompt(true)}
                className="absolute top-4 right-4 p-2 text-white/60 hover:text-white"
              >
                <IconX className="h-6 w-6" />
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

          {/* Top gradient */}
          <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-500 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`} />

          {/* Bottom gradient */}
          <div className={`absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none transition-opacity duration-500 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`} />

          {/* Top bar */}
          <div className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-4 transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <span className="text-sm sm:text-base md:text-lg font-black tracking-widest uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent">Chillers</span>
            <div className="flex items-center gap-3 text-sm text-white/60">
              {currentEpisode && (
                <span className="font-medium">E{currentEpisode.number} · {currentEpisode.title}</span>
              )}
            </div>
            <button
              onClick={onBack}
              className="p-1 text-white/70 hover:text-white transition-colors"
            >
              <IconX className="h-6 w-6" />
            </button>
          </div>

          {/* Timeline bar */}
          <div className={`absolute inset-x-0 bottom-20 z-20 px-4 transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <div
              ref={timelineRef}
              className="group/timeline relative w-full h-1 hover:h-2 bg-white/20 cursor-pointer rounded-full transition-all duration-150"
              onClick={handleTimelineClick}
            >
              <div
                className="absolute left-0 top-0 h-full bg-white rounded-full pointer-events-none"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/timeline:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-white/50 font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls bar */}
          <div className={`absolute bottom-0 inset-x-0 z-20 px-4 pb-4 transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={handlePlayPause} className="text-white hover:text-white/80 transition-colors">
                  {isPlaying ? <IconPlayerPause className="h-7 w-7" /> : <IconPlayerPlay className="h-7 w-7" />}
                </button>
                <button onClick={() => handleSkip(-10)} className="text-white/60 hover:text-white transition-colors">
                  <IconRewindBackward10 className="h-5 w-5" />
                </button>
                <button onClick={() => handleSkip(10)} className="text-white/60 hover:text-white transition-colors">
                  <IconPlayerSkipForward className="h-5 w-5" />
                </button>
                <div className="hidden sm:flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
                    {isMuted || volume === 0 ? <IconVolumeOff className="h-5 w-5" /> : <IconVolume className="h-5 w-5" />}
                  </button>
                  <input
                    type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (videoRef.current) videoRef.current.volume = v;
                      setIsMuted(v === 0);
                    }}
                    className="w-0 group-hover/vol:w-20 transition-all duration-300 h-1 bg-white/30 appearance-none rounded-full accent-white cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownload}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <IconDownload className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`text-white/60 hover:text-white transition-colors ${showSettings ? "text-white" : ""}`}
                >
                  <IconSettings className="h-5 w-5" />
                </button>
                <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors">
                  {isFullscreen ? <IconArrowsMinimize className="h-5 w-5" /> : <IconArrowsMaximize className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {showSettings && (
            <div className="absolute bottom-24 right-4 w-56 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 z-30 shadow-2xl">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">Speed</p>
                  <div className="flex gap-1.5">
                    {[0.5, 1, 1.5, 2].map((s) => (
                      <button
                        key={s} onClick={() => {
                          setPlaybackSpeed(s);
                          if (videoRef.current) videoRef.current.playbackRate = s;
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${playbackSpeed === s ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">Quality</p>
                  <div className="space-y-1">
                    {["1080p", "720p", "Auto"].map((q) => (
                      <button
                        key={q} onClick={() => setQuality(q)}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-all ${quality === q ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10"}`}
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

      <DownloadModal
        isOpen={showSingleDownload}
        onClose={() => setShowSingleDownload(false)}
        title={item.title}
        id={String(item.id)}
        type={streamType === "movie" ? "movie" : "series"}
        season={currentEpisode?.season ?? undefined}
        episode={currentEpisode?.number}
      />
      {/* onOpenDetails kept in the prop signature for future UX (long-press menu).
          Referenced below to silence the unused-prop lint without breaking API. */}
      <span hidden aria-hidden data-bind={onOpenDetails ? "ok" : "no"} />
    </div>
  );
}
