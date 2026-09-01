"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageContext";
import type { MovieOrShow, Episode } from "@/types/media";
import {
  IconX,
  IconDownload,
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
  IconVolumeOff,
  IconMaximize,
  IconPictureInPicture,
  IconSubtitles,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconLoader2,
  IconSettings,
} from "@tabler/icons-react";
import NotificationModal from "./NotificationModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import { isIframeProviderUrl, toEmbedUrl } from "@/lib/providers";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { useStreamUrl } from "@/hooks/useStreamUrl";
import { useTorrentPlayback } from "@/hooks/useTorrentPlayback";
import { parseTmdbId } from "@/services/tmdb";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import { isSlowConnection } from "@/services/media";
import Hls from "hls.js";

interface VideoPlayerProps {
  item: MovieOrShow;
  episode?: Episode;
  onBack: () => void;
  onOpenDetails?: (item: MovieOrShow) => void;
}

const PROGRESS_PERSIST_DEBOUNCE_MS = 5_000;
const RESUME_MIN_SECONDS = 5;
const SEEK_STEP_SECONDS = 10;
const VOLUME_STEP = 0.1;

export default function VideoPlayer({ item, episode, onBack }: VideoPlayerProps) {
  const { lang, translate: _ } = useLanguage();
  const { token, user, updateUser } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<Array<{ index: number; label: string; height: number; bitrate: number }>>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [subtitles, setSubtitles] = useState<Array<{ fileId: number; lang: string; langName?: string }>>([]);
  const [activeSubId, setActiveSubId] = useState<number | null>(null);

  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissPortraitPrompt, setDismissPortraitPrompt] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const [showSingleDownload, setShowSingleDownload] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const currentEpisode = episode;

  /* ───────── Orientation check ───────── */
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsPortrait(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ───────── VidLink progress bridge ───────── */
  const allowedMessageOrigins = useMemo(() => new Set(["https://vidlink.pro"]), []);
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

  /* ───────── Persistence de progression ───────── */
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

      // Sync with backend if logged in
      if (token) {
        userService.updateProgress(token, {
          tmdbId: String(item.id),
          mediaType: item.type as "movie" | "series" | "anime",
          season: currentEpisode?.season,
          episode: currentEpisode?.number,
          progress: currentTime,
          duration: duration,
          title: item.title,
          posterPath: item.posterUrl,
          backdropPath: item.backdropUrl,
        }).then((res) => {
          if (res?.success) {
            const updates: any = { continueWatching: res.continueWatching };
            if (res.watchHistory) updates.watchHistory = res.watchHistory;
            updateUser(updates);
          }
        }).catch(err => console.error("Failed to sync progress", err));
      }
    },
    [currentTime, duration, progressKey, token, item.id, item.type, currentEpisode],
    PROGRESS_PERSIST_DEBOUNCE_MS,
  );

  /* ───────── Stream URL ───────── */
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
  // URL de téléchargement direct (fallback torrent) — type chillers-test :
  // le backend proxy le flux TorrServer avec Content-Disposition: attachment.
  const torrentDownloadUrl = streamQuery.data?.downloadUrl ?? null;
  const serverVideoUrl = useMemo(
    () => toEmbedUrl(resolvedStreamUrl ?? item.videoUrl ?? undefined),
    [resolvedStreamUrl, item.videoUrl],
  );
  const isIframe = isIframeProviderUrl(serverVideoUrl);

  /* ───────── P2P client-side (WebTorrent) ─────────
     Privilégié quand aucun provider classique n'a de flux, ou quand le flux
     vient du fallback torrent (transcode FFmpeg) : si des pairs sont
     joignables, la lecture se fait 100 % localement (décodage GPU, 0 octet
     via le serveur). Le flux serveur reste le filet de sécurité. */
  const canP2P =
    !isIframe &&
    !!item.title &&
    (!resolvedStreamUrl || resolvedStreamUrl.startsWith("/api/torrents/"));

  const p2p = useTorrentPlayback({
    enabled: canP2P && hasStarted,
    title: item.title,
    year: item.year,
    type: streamType,
    season: currentEpisode?.season,
    episode: currentEpisode?.number,
    videoRef,
  });
  const [p2pHardFail, setP2pHardFail] = useState(false);
  const p2pActive = p2p.status === "ready" && !p2pHardFail;
  const p2pHasTorrent = !["idle", "fetching", "error"].includes(p2p.status);
  // Pendant la lecture P2P, le lecteur appartient à renderTo (MediaSource) :
  // on laisse la src du <video> dériver du flux serveur sinon.
  const videoUrl = p2pActive ? undefined : serverVideoUrl;

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} Mo/s`;
    if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} Ko/s`;
    return "0 B/s";
  };

  // Auto-guérison : P2P sans pair → relance la chaîne classique (qui peut
  // déboucher sur un flux direct ou le transcode serveur).
  useEffect(() => {
    if ((p2p.status === "stalled" || p2p.status === "error") && !resolvedStreamUrl) {
      void streamQuery.refetch();
    }
  }, [p2p.status, resolvedStreamUrl, streamQuery]);
  const isHls = !isIframe && !!videoUrl && (videoUrl.includes(".m3u8") || videoUrl.includes("m3u8"));

  /* ───────── HLS setup & Network Optimization ───────── */
  useEffect(() => {
    if (isIframe || !videoUrl || !hasStarted) return;
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const slowConn = isSlowConnection();
    setIsLowBandwidth(slowConn);

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          capLevelToPlayerSize: true, // Don't fetch 1080p if screen or window is small
          abrEwmaDefaultEstimate: slowConn ? 350_000 : 750_000, // conservative bandwidth start
          abrBandWidthFactor: 0.75, // safety margin before stepping up
          abrBandWidthUpFactor: 0.7, // slow ramp up prevents buffering jitter
          maxBufferLength: 30, // 30s forward buffer
          maxMaxBufferLength: 60, // 60s max
          backBufferLength: 10, // keep 10s to conserve memory
          maxBufferSize: 25 * 1024 * 1024,
          lowLatencyMode: false, // deep buffer for stability on packet-lossy connections
          startLevel: slowConn ? 0 : -1, // start at lowest bitrate immediately on 2G/3G

          // Aggressive loading retries on bad connections:
          fragLoadingMaxRetry: 8,
          fragLoadingRetryDelay: 1000,
          fragLoadingMaxRetryTimeout: 64000,
          manifestLoadingMaxRetry: 8,
          manifestLoadingRetryDelay: 1000,
          manifestLoadingMaxRetryTimeout: 64000,
          levelLoadingMaxRetry: 8,
          levelLoadingRetryDelay: 1000,
          levelLoadingMaxRetryTimeout: 64000,
        });

        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (data && data.levels && data.levels.length > 1) {
            const lvls = data.levels.map((l, idx) => ({
              index: idx,
              height: l.height,
              bitrate: l.bitrate,
              label: l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`,
            }));
            setQualityLevels(lvls);
          }
          video.play().catch(() => {});
        });

        // Error recovery against network dropouts and media stalls
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("[HLS] Network error, recovering...", data);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("[HLS] Media error, recovering...", data);
                hls.recoverMediaError();
                break;
              default:
                console.error("[HLS] Fatal error, destroying instance", data);
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
        video.play().catch(() => {});
      }
    } else {
      video.src = videoUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl, isHls, isIframe, hasStarted]);

  /* ───────── Quality Selector Handler ───────── */
  const changeQuality = useCallback((qualityIndex: number) => {
    setCurrentQuality(qualityIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityIndex;
    }
    setShowQualityMenu(false);
  }, []);

  /* ───────── Buffer range calculation ───────── */
  const updateProgressAndBuffer = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime || 0;
    setCurrentTime(cur);

    if (video.duration > 0 && video.buffered.length > 0) {
      const b = video.buffered;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= cur && cur <= b.end(i)) {
          setBufferedPct(Math.min(100, (b.end(i) / video.duration) * 100));
          return;
        }
      }
      setBufferedPct(Math.min(100, (b.end(b.length - 1) / video.duration) * 100));
    }
  }, []);

  /* ───────── Stall Auto-Recovery Watchdog ───────── */
  useEffect(() => {
    if (!isBuffering || !isPlaying) return;
    const timer = setTimeout(() => {
      const video = videoRef.current;
      if (video && video.paused === false) {
        // Nudge playback slightly to unstick dropped frames or buffer gaps
        try {
          if (video.buffered.length > 0) {
            video.currentTime = video.currentTime + 0.05;
          }
        } catch {}
      }
    }, 4500);
    return () => clearTimeout(timer);
  }, [isBuffering, isPlaying]);

  /* ───────── Sous-titres OpenSubtitles ───────── */
  useEffect(() => {
    if (isIframe) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          title: item.title,
          type: item.type === "movie" || item.type === "documentary" ? "movie" : "tv",
          langs: "fr,en",
        });
        if (item.year > 0) params.set("year", String(item.year));
        if (currentEpisode?.season) params.set("season", String(currentEpisode.season));
        if (currentEpisode?.number) params.set("episode", String(currentEpisode.number));
        const res = await fetch(`/api/subtitles/find?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const subs: Array<{ fileId: number; lang: string; langName?: string }> = json?.subtitles ?? [];
        if (subs.length > 0) {
          setSubtitles(subs.slice(0, 12));
          if (lang === "fr") {
            const fr = subs.find((s) => s.lang.toLowerCase() === "fr");
            if (fr) setActiveSubId(fr.fileId);
          }
        }
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [isIframe, videoUrl, item.title, item.year, item.type, currentEpisode, lang]);

  /* ───────── Controls auto-hide ───────── */
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    setShowControls(true);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const handleMouseMove = useCallback(() => {
    scheduleHideControls();
  }, [scheduleHideControls]);

  /* ───────── Contrôles ───────── */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const changeVolume = useCallback((newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    if (clamped > 0 && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(video.duration || 0, (video.currentTime || 0) + seconds));
    video.currentTime = target;
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else {
      video.requestPictureInPicture?.().catch(() => {});
    }
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  /* ───────── Reprise au chargement ───────── */
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    const saved = localStorage.getItem(progressKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Number.isFinite(parsed?.time) && parsed.time > RESUME_MIN_SECONDS) {
        video.currentTime = parsed.time;
        const minutes = Math.floor(parsed.time / 60);
        const seconds = Math.floor(parsed.time % 60);
        setNotification({
          title: "Reprise de la lecture",
          message: `Reprise à ${minutes}:${String(seconds).padStart(2, "0")}`,
        });
        setTimeout(() => setNotification(null), 2500);
      }
    } catch { /* ignore */ }
  }, [progressKey]);

  /* ───────── Raccourcis clavier ───────── */
  useEffect(() => {
    if (isIframe) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); seekBy(-SEEK_STEP_SECONDS); break;
        case "ArrowRight": e.preventDefault(); seekBy(SEEK_STEP_SECONDS); break;
        case "ArrowUp": e.preventDefault(); changeVolume(volume + VOLUME_STEP); break;
        case "ArrowDown": e.preventDefault(); changeVolume(volume - VOLUME_STEP); break;
        case "j": case "J": seekBy(-SEEK_STEP_SECONDS); break;
        case "l": case "L": seekBy(SEEK_STEP_SECONDS); break;
        case "k": case "K": case " ": e.preventDefault(); togglePlay(); break;
        case "m": case "M": toggleMute(); break;
        case "f": case "F": toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isIframe, seekBy, changeVolume, volume, togglePlay, toggleMute, toggleFullscreen]);

  /* ───────── Démarrage ───────── */
  const startPlayback = useCallback(() => {
    setHasStarted(true);
    if (!isIframe && videoRef.current) {
      videoRef.current.play?.().catch(() => {});
    }
  }, [isIframe]);

  const coverSrc = item.backdropUrl || item.posterUrl || "";

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  /* ─── Styles ─── */
  const controlsVisible = showControls || !isPlaying;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video max-h-[72vh] bg-black rounded-xl overflow-hidden select-none shadow-[0_8px_48px_rgba(0,0,0,0.85)] group/container"
      onMouseMove={handleMouseMove}
      onDoubleClick={hasStarted ? toggleFullscreen : undefined}
    >
      {/* ─── IFRAME mode (providers externes) ─── */}
      {isIframe ? (
        <>
          <iframe
            key={videoUrl}
            src={hasStarted ? videoUrl : "about:blank"}
            className={`absolute inset-0 w-full h-full border-none bg-black transition-opacity duration-300 ${
              hasStarted ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; gyroscope; accelerometer; clipboard-write"
            allowFullScreen
            referrerPolicy="origin"
            title={item.title}
            scrolling="no"
            sandbox="allow-scripts allow-same-origin allow-forms allow-orientation-lock allow-presentation"
          />
          {/* iframe top bar on hover */}
          <div
            className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 transition-opacity duration-300 ${
              controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <span className="text-sm font-black tracking-widest uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent">
              Chillers
            </span>
            <div className="flex items-center gap-1">
              <button onClick={toggleFullscreen} className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors" title="Plein écran">
                <IconMaximize className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      ) : videoUrl || canP2P ? (
        <>
          {/* ─── VIDEO NATIVE (dont lecture P2P via renderTo) ─── */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            playsInline
            preload="auto"
            onTimeUpdate={updateProgressAndBuffer}
            onProgress={updateProgressAndBuffer}
            onLoadedMetadata={handleLoadedMetadata}
            onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
            onPlay={() => setIsPlaying(true)}
            onEnded={() => {
              setIsPlaying(false);
              if (token) {
                userService.markAsWatched(token, {
                  tmdbId: String(item.id),
                  mediaType: item.type as "movie" | "series" | "anime",
                  season: currentEpisode?.season,
                  episode: currentEpisode?.number,
                  title: item.title,
                  posterPath: item.posterUrl,
                }).then((res) => {
                  if (res?.success && res.watchHistory) {
                    updateUser({ watchHistory: res.watchHistory });
                  }
                }).catch(console.error);
              }
              if (onBack) onBack();
            }}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onPlaying={() => setIsBuffering(false)}
            onVolumeChange={() => {
              const v = videoRef.current;
              if (v) { setIsMuted(v.muted); setVolume(v.volume); }
            }}
            onError={(e) => {
              // Échec de décodage du flux P2P (ex: HEVC non supporté) →
              // bascule immédiate vers le flux serveur si disponible.
              const el = e.currentTarget;
              if (p2pActive && serverVideoUrl && !p2pHardFail) {
                setP2pHardFail(true);
                el.src = serverVideoUrl;
                el.play().catch(() => {});
              }
            }}
          >
            {subtitles.map((sub) => (
              <track
                key={sub.fileId}
                kind="subtitles"
                src={`/api/subtitles/file/${sub.fileId}`}
                srcLang={sub.lang}
                label={sub.langName || sub.lang}
                default={sub.fileId === activeSubId}
              />
            ))}
          </video>

          {/* ─── Buffering spinner ─── */}
          {isBuffering && hasStarted && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <IconLoader2 className="h-12 w-12 text-[#D70466] animate-spin drop-shadow-lg" />
            </div>
          )}

          {/* ─── CONTROLS OVERLAY ─── */}
          <div
            className={`absolute inset-0 z-20 flex flex-col pointer-events-none transition-opacity duration-300 ${
              controlsVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* ── Top bar (floating glass header) ── */}
            <div className="pointer-events-auto flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full shadow-lg">
                <span className="text-xs sm:text-sm font-black tracking-widest uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent">
                  Chillers
                </span>
                {currentEpisode ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-[11px] sm:text-xs text-white/90 font-semibold truncate max-w-[160px] sm:max-w-xs">
                      S{String(currentEpisode.season ?? 1).padStart(2, "0")}E{String(currentEpisode.number).padStart(2, "0")} · {currentEpisode.title}
                    </span>
                  </>
                ) : item.title ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-[11px] sm:text-xs text-white/90 font-semibold truncate max-w-[160px] sm:max-w-xs">
                      {item.title}
                    </span>
                  </>
                ) : null}
                {isLowBandwidth && (
                  <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5" title="Mode réseau faible actif - Qualité optimisée">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Mode Éco
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* ── Tuile de statut P2P ── */}
                {canP2P && hasStarted && ["fetching", "scanning", "connecting"].includes(p2p.status) && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#22d3ee] bg-black/40 backdrop-blur-xl border border-[#22d3ee]/30 rounded-full px-2.5 py-1.5 shadow-lg">
                    <IconLoader2 className="h-3 w-3 animate-spin" />
                    P2P…
                  </span>
                )}
                {canP2P && p2pActive && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-black/40 backdrop-blur-xl border border-emerald-400/30 rounded-full px-2.5 py-1.5 shadow-lg">
                    P2P · {p2p.peers} pair{p2p.peers > 1 ? "s" : ""} · {formatSpeed(p2p.downloadSpeed)}
                  </span>
                )}
              </div>
            </div>

            {/* ── Center click zone ── */}
            <div className="flex-1 pointer-events-auto cursor-pointer" onClick={togglePlay} />

            {/* ── Bottom floating glassmorphic control bar ── */}
            <div className="pointer-events-auto bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-8 sm:pt-12 pb-3 sm:pb-5 px-3 sm:px-6">
              <div className="rounded-2xl bg-zinc-950/65 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-3 sm:p-4 space-y-2.5">
                {/* ── Progress bar with real-time buffered segment indicator ── */}
                <div
                  className="group/prog w-full h-4 flex items-center cursor-pointer select-none"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    seekTo(pct * duration);
                  }}
                >
                  <div className="relative w-full h-1.5 group-hover/prog:h-2.5 rounded-full bg-white/15 backdrop-blur-md transition-all duration-200 overflow-hidden group-hover/prog:overflow-visible">
                    {/* Buffered track */}
                    <div
                      className="absolute inset-y-0 left-0 bg-white/30 rounded-full transition-all duration-300 pointer-events-none"
                      style={{ width: `${bufferedPct}%` }}
                    />
                    {/* Played track */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#D70466] to-[#7C3AED] rounded-full shadow-[0_0_12px_rgba(215,4,102,0.6)]"
                      style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-[#D70466] opacity-0 group-hover/prog:opacity-100 scale-0 group-hover/prog:scale-100 transition-all duration-150" />
                    </div>
                  </div>
                </div>

                {/* ── Buttons row ── */}
                <div className="flex items-center justify-between gap-2">
                  {/* Left cluster: Play/Pause | seek-back | volume | time badge */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {/* Centered / prominent Play/Pause Button */}
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#D70466] to-[#7C3AED] text-white flex items-center justify-center shadow-[0_0_16px_rgba(215,4,102,0.4)] hover:scale-105 active:scale-95 transition-all ring-1 ring-white/25 flex-shrink-0"
                      title={isPlaying ? "Pause (K)" : "Lire (K)"}
                    >
                      {isPlaying ? (
                        <IconPlayerPause className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" />
                      ) : (
                        <IconPlayerPlay className="h-4 w-4 sm:h-5 sm:w-5 translate-x-0.5" fill="currentColor" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => seekBy(-10)}
                      className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                      title="Reculer 10s (←)"
                    >
                      <IconPlayerSkipBack className="h-[18px] w-[18px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => seekBy(10)}
                      className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                      title="Avancer 10s (→)"
                    >
                      <IconPlayerSkipForward className="h-[18px] w-[18px]" />
                    </button>

                    {/* Volume */}
                    <div className="flex items-center group/vol">
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                        title="Mute (M)"
                      >
                        {isMuted || volume === 0 ? (
                          <IconVolumeOff className="h-[18px] w-[18px] text-red-400" />
                        ) : (
                          <IconVolume className="h-[18px] w-[18px]" />
                        )}
                      </button>
                      <div className="overflow-hidden transition-all duration-200 w-0 group-hover/vol:w-[72px] sm:group-hover/vol:w-[84px]">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={(e) => changeVolume(Number(e.target.value))}
                          className="w-[72px] sm:w-[84px] h-[4px] accent-[#D70466] cursor-pointer appearance-none rounded-full bg-white/20"
                        />
                      </div>
                    </div>

                    {/* Elapsed & Duration time badge */}
                    <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-white/90 shadow-inner ml-1">
                      <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                      <span className="text-white/40">/</span>
                      <span className="text-white/60">{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Right cluster: quality | speed | subtitles | pip | fullscreen */}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {/* Time in mobile */}
                    <div className="flex sm:hidden items-center gap-1 text-[11px] font-mono text-white/80 mr-1">
                      <span>{formatTime(currentTime)}</span>
                      <span className="text-white/40">/</span>
                      <span className="text-white/50">{formatTime(duration)}</span>
                    </div>

                    {/* Quality Menu */}
                    {qualityLevels.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowQualityMenu(!showQualityMenu);
                            setShowSpeedMenu(false);
                            setShowSubMenu(false);
                          }}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                            currentQuality !== -1
                              ? "text-white bg-[#D70466]/30 border-[#D70466]/50 shadow-[0_0_12px_rgba(215,4,102,0.3)]"
                              : "text-white/80 bg-white/5 border-white/10 hover:bg-white/15 hover:text-white"
                          }`}
                          title="Qualité vidéo"
                        >
                          {currentQuality === -1
                            ? isLowBandwidth
                              ? "Éco"
                              : "Auto"
                            : qualityLevels.find((q) => q.index === currentQuality)?.label || "HD"}
                        </button>
                        {showQualityMenu && (
                          <div className="absolute bottom-full right-0 mb-3 w-36 py-1.5 bg-zinc-900/85 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150">
                            <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">Qualité</div>
                            <button
                              onClick={() => changeQuality(-1)}
                              className={`px-3 py-1.5 text-xs text-left font-medium rounded-xl mx-1 transition-all ${
                                currentQuality === -1
                                  ? "text-white font-bold bg-gradient-to-r from-[#D70466]/30 to-[#7C3AED]/30 border border-[#D70466]/40"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              Auto {isLowBandwidth && "(Éco)"}
                            </button>
                            {qualityLevels.map((lvl) => (
                              <button
                                key={lvl.index}
                                onClick={() => changeQuality(lvl.index)}
                                className={`px-3 py-1.5 text-xs text-left font-medium rounded-xl mx-1 transition-all ${
                                  currentQuality === lvl.index
                                    ? "text-white font-bold bg-gradient-to-r from-[#D70466]/30 to-[#7C3AED]/30 border border-[#D70466]/40"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {lvl.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Torrent Quality Menu */}
                    {canP2P && p2p.availableQualities && p2p.availableQualities.length > 1 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowQualityMenu(!showQualityMenu);
                            setShowSpeedMenu(false);
                            setShowSubMenu(false);
                          }}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg border text-white/80 bg-white/5 border-white/10 hover:bg-white/15 hover:text-white transition-all"
                          title="Qualité Torrent"
                        >
                          {p2p.availableQualities.find((q) => q.infoHash === p2p.magnet?.infoHash)?.quality || "HD"}
                        </button>
                        {showQualityMenu && (
                          <div className="absolute bottom-full right-0 mb-3 w-36 py-1.5 bg-zinc-900/85 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150">
                            <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">Qualité Torrent</div>
                            {p2p.availableQualities.map((qual, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setShowQualityMenu(false);
                                  if (p2p.magnet?.infoHash !== qual.infoHash) {
                                    p2p.retry(qual);
                                  }
                                }}
                                className={`px-3 py-1.5 text-xs text-left font-medium rounded-xl mx-1 transition-all ${
                                  p2p.magnet?.infoHash === qual.infoHash
                                    ? "text-white font-bold bg-gradient-to-r from-[#D70466]/30 to-[#7C3AED]/30 border border-[#D70466]/40"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {qual.quality}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Speed Selector */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSpeedMenu(!showSpeedMenu);
                          setShowSubMenu(false);
                          setShowQualityMenu(false);
                        }}
                        className={`p-2 rounded-xl transition-all ${
                          playbackRate !== 1
                            ? "text-[#D70466] bg-[#D70466]/15 border border-[#D70466]/30"
                            : "text-white/80 hover:text-white hover:bg-white/10"
                        }`}
                        title="Vitesse de lecture"
                      >
                        <IconSettings className="h-[18px] w-[18px]" />
                      </button>
                      {showSpeedMenu && (
                        <div className="absolute bottom-full right-0 mb-3 w-32 py-1.5 bg-zinc-900/85 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">Vitesse</div>
                          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                            <button
                              key={rate}
                              onClick={() => changePlaybackRate(rate)}
                              className={`px-3 py-1.5 text-xs text-left font-medium rounded-xl mx-1 transition-all ${
                                playbackRate === rate
                                  ? "text-white font-bold bg-gradient-to-r from-[#D70466]/30 to-[#7C3AED]/30 border border-[#D70466]/40"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {rate}x {rate === 1 && "(Normal)"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Subtitles */}
                    {subtitles.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSubMenu(!showSubMenu);
                            setShowSpeedMenu(false);
                            setShowQualityMenu(false);
                          }}
                          className={`p-2 rounded-xl transition-all ${
                            activeSubId !== null
                              ? "text-white bg-[#D70466]/30 border border-[#D70466]/40 shadow-[0_0_12px_rgba(215,4,102,0.3)]"
                              : "text-white/80 hover:text-white hover:bg-white/10"
                          }`}
                          title="Sous-titres"
                        >
                          <IconSubtitles className="h-[18px] w-[18px]" />
                        </button>
                        {showSubMenu && (
                          <div className="absolute bottom-full right-0 mb-3 w-44 py-1.5 bg-zinc-900/85 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] flex flex-col z-50 max-h-52 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                            <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-wider">Sous-titres</div>
                            <button
                              onClick={() => {
                                setActiveSubId(null);
                                setShowSubMenu(false);
                              }}
                              className={`px-3 py-1.5 text-xs text-left font-medium rounded-xl mx-1 transition-all ${
                                activeSubId === null
                                  ? "text-white font-bold bg-gradient-to-r from-[#D70466]/30 to-[#7C3AED]/30 border border-[#D70466]/40"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              Désactivé
                            </button>
                            {subtitles.map((sub) => (
                              <button
                                key={sub.fileId}
                                onClick={() => {
                                  setActiveSubId(sub.fileId);
                                  setShowSubMenu(false);
                                }}
                                className={`px-3 py-1.5 text-xs text-left font-medium rounded-xl mx-1 transition-all ${
                                  activeSubId === sub.fileId
                                    ? "text-white font-bold bg-gradient-to-r from-[#D70466]/30 to-[#7C3AED]/30 border border-[#D70466]/40"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {sub.langName || sub.lang.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PiP */}
                    <button
                      type="button"
                      onClick={togglePiP}
                      className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                      title="Image dans l'image"
                    >
                      <IconPictureInPicture className="h-[18px] w-[18px]" />
                    </button>

                    {/* Fullscreen */}
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all"
                      title="Plein écran (F)"
                    >
                      <IconMaximize className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Portrait prompt (mobile) ─── */}
          {isPortrait && !dismissPortraitPrompt && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/85 backdrop-blur-sm sm:hidden">
              <button onClick={() => setDismissPortraitPrompt(true)} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/10">
                <IconX className="h-5 w-5" />
              </button>
              <svg className="h-20 w-20 text-white/70 animate-[spin_3s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18.01" />
              </svg>
              <p className="text-white text-lg font-bold text-center px-8">Tourne ton téléphone</p>
              <p className="text-white/60 text-sm text-center px-8 max-w-xs">Mode paysage recommandé</p>
              <button onClick={() => setDismissPortraitPrompt(true)} className="mt-2 px-5 py-2 text-xs font-semibold text-white/80 hover:text-white border border-white/20 rounded-full hover:bg-white/10 transition-colors">
                Continuer en portrait
              </button>
            </div>
          )}
        </>
      ) : null}

      {/* ─── COVER OVERLAY (avant le démarrage) ─── */}
      {(videoUrl || (canP2P && !streamQuery.isLoading)) && !hasStarted && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Lire la vidéo"
          onClick={startPlayback}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startPlayback(); } }}
          className="absolute inset-0 z-30 cursor-pointer group overflow-hidden"
        >
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={item.title}
              fill
              priority
              sizes="100vw"
              className="object-cover scale-105 transition-transform duration-700 ease-out group-hover:scale-100"
              style={{ filter: "brightness(0.55) saturate(1.1)" }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />

          <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-10 pointer-events-none">
            <span className="text-sm font-black tracking-widest uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent drop-shadow-lg">
              Chillers
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <IconX className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          <div className="relative z-10 h-full w-full flex flex-col items-center justify-center px-6 text-center">
            {item.type && (
              <span className="mb-3 inline-block px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest border border-white/20 bg-white/10 text-white/90 backdrop-blur-sm">
                {item.type}
              </span>
            )}
            <h2 className="block max-w-3xl text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-2xl [overflow-wrap:anywhere]">
              {item.title}
            </h2>
            {currentEpisode && (
              <p className="mt-2 block max-w-2xl text-sm sm:text-base text-white/80 font-medium">
                S{String(currentEpisode.season ?? 1).padStart(2, "0")}E{String(currentEpisode.number).padStart(2, "0")} · {currentEpisode.title}
              </p>
            )}
            <div className="mt-6 sm:mt-8">
              <button
                type="button"
                onClick={startPlayback}
                aria-label="Lire la vidéo"
                className="group/play relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#D70466] to-[#7C3AED] shadow-[0_16px_60px_rgba(215,4,102,0.55)] transition-transform duration-200 ease-out hover:scale-110 active:scale-95"
              >
                <IconPlayerPlay className="h-9 w-9 sm:h-11 sm:w-11 text-white drop-shadow-md translate-x-0.5" fill="currentColor" />
                <span className="absolute inset-0 rounded-full ring-2 ring-white/0 group-hover/play:ring-white/30 transition-all duration-300" />
              </button>
            </div>
            <p className="mt-3 block text-[11px] sm:text-xs text-white/50 font-medium tracking-wider uppercase">
              Cliquez pour lancer le streaming
            </p>
          </div>
        </div>
      )}

      {/* ─── Loading state ─── */}
      {!videoUrl && streamQuery.isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950">
          <div className="h-14 w-14 rounded-full border-[3px] border-white/10 border-t-[#D70466] border-r-[#7C3AED] animate-spin" />
          <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Chargement du flux…</p>
        </div>
      )}

      {/* ─── P2P sans pair joignable ─── */}
      {p2p.status === "stalled" && !serverVideoUrl && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-zinc-950/95">
          <p className="text-zinc-400 text-sm text-center px-6 max-w-sm">
            Aucun pair P2P joignable pour ce torrent.<br />
            La lecture serveur a été tentée sans succès.
          </p>
          <button
            type="button"
            onClick={() => { setP2pHardFail(false); p2p.retry(); }}
            className="px-5 py-2 text-xs font-bold text-white bg-[#D70466] hover:bg-[#b90356] rounded-full transition-colors"
          >
            Réessayer en P2P
          </button>
        </div>
      )}

      {/* ─── Modals ─── */}
      {showSingleDownload && (
        <DownloadModal
          isOpen={showSingleDownload}
          onClose={() => setShowSingleDownload(false)}
          title={item.title}
          id={String(item.id)}
          type={streamType}
          season={currentEpisode?.season}
          episode={currentEpisode?.number}
        />
      )}
      <NotificationModal
        isOpen={!!notification}
        title={notification?.title ?? ""}
        message={notification?.message ?? ""}
        onClose={() => setNotification(null)}
      />
    </div>
  );
}
