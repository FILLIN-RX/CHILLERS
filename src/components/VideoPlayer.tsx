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
  IconVolume2,
  IconVolume3,
  IconVolumeOff,
  IconMaximize,
  IconPictureInPicture,
  IconSubtitles,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconLoader2,
  IconSettings,
  IconArrowLeft,
  IconRotate2,
  IconCrown,
} from "@tabler/icons-react";
import NotificationModal from "./NotificationModal";
import DownloadModal from "@/features/downloads/DownloadModal";
import { isIframeProviderUrl, toEmbedUrl } from "@/lib/providers";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { useStreamUrl } from "@/hooks/useStreamUrl";
import { useTorrentPlayback } from "@/hooks/useTorrentPlayback";
import { useAuthStore } from "@/stores/useAuthStore";
import { userService } from "@/services/user";
import { isSlowConnection } from "@/services/media";
import { getAntiBotHeaders } from "@/lib/antibot";
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
  const isPro = user?.subscription?.plan === "premium" || user?.role === "admin";
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
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const [centerFeedback, setCenterFeedback] = useState<{ icon: "play" | "pause" | "forward" | "backward"; key: number } | null>(null);
  const [isTheater, setIsTheater] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [settingsTab, setSettingsTab] = useState<"main" | "speed" | "quality" | "subtitles">("main");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentEpisode = episode;

  const triggerFeedback = useCallback((icon: "play" | "pause" | "forward" | "backward") => {
    setCenterFeedback({ icon, key: Date.now() });
    setTimeout(() => {
      setCenterFeedback((prev) => (prev?.key ? null : prev));
    }, 600);
  }, []);

  /* ───────── Native Fullscreen event listeners ───────── */
  useEffect(() => {
    const onFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  /* ───────── Orientation check & Auto Fullscreen ───────── */
  useEffect(() => {
    const checkOrientation = () => {
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      const isMobileDevice =
        window.innerWidth < 1024 ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);

      setIsPortrait(!isLandscape);

      // Auto-fullscreen on rotation
      if (isLandscape && isMobileDevice && hasStarted && !isFullscreen) {
        enterFullscreen();
      } else if (!isLandscape && isMobileDevice && isFullscreen) {
        exitFullscreen();
      }
    };

    const mq = window.matchMedia("(orientation: portrait)");
    const mqHandler = () => checkOrientation();
    mq.addEventListener("change", mqHandler);
    window.addEventListener("orientationchange", checkOrientation);
    window.addEventListener("resize", checkOrientation);

    return () => {
      mq.removeEventListener("change", mqHandler);
      window.removeEventListener("orientationchange", checkOrientation);
      window.removeEventListener("resize", checkOrientation);
    };
  }, [hasStarted, isFullscreen]);

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
        const res = await fetch(`/api/subtitles/find?${params.toString()}`, {
          headers: getAntiBotHeaders(),
        });
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
    if (video.paused) {
      video.play().catch(() => {});
      triggerFeedback("play");
    } else {
      video.pause();
      triggerFeedback("pause");
    }
  }, [triggerFeedback]);

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
    triggerFeedback(seconds > 0 ? "forward" : "backward");
  }, [triggerFeedback]);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;

    // 1. Standard HTML5 Fullscreen API (Desktop, Android, tablets)
    if (container && container.requestFullscreen) {
      try {
        await container.requestFullscreen();
        setIsFullscreen(true);
        try {
          await (screen.orientation as any)?.lock?.("landscape");
        } catch (_) {}
        return;
      } catch (_) {}
    } else if (container && (container as any).webkitRequestFullscreen) {
      try {
        (container as any).webkitRequestFullscreen();
        setIsFullscreen(true);
        return;
      } catch (_) {}
    }

    // 2. Native Video Fullscreen on iOS (iPhone Safari for direct video streams)
    if (video && (video as any).webkitEnterFullscreen && !isIframe) {
      try {
        (video as any).webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      } catch (_) {}
    }

    // 3. Fallback CSS pseudo-fullscreen on iOS / mobile (covers 100% of iPhone screen)
    setIsFullscreen(true);
    try {
      await (screen.orientation as any)?.lock?.("landscape");
    } catch (_) {}
  }, [isIframe]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } catch (_) {}
    }

    const video = videoRef.current;
    if (video && (video as any).webkitExitFullscreen) {
      try {
        (video as any).webkitExitFullscreen();
      } catch (_) {}
    }

    setIsFullscreen(false);
    try {
      (screen.orientation as any)?.unlock?.();
    } catch (_) {}
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen || document.fullscreenElement || (document as any).webkitFullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

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

  /* ───────── Raccourcis clavier (Style YouTube) ───────── */
  useEffect(() => {
    if (isIframe) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        const pct = parseInt(e.key, 10) / 10;
        seekTo(pct * duration);
        return;
      }
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); seekBy(-5); break;
        case "ArrowRight": e.preventDefault(); seekBy(5); break;
        case "ArrowUp": e.preventDefault(); changeVolume(volume + VOLUME_STEP); break;
        case "ArrowDown": e.preventDefault(); changeVolume(volume - VOLUME_STEP); break;
        case "j": case "J": seekBy(-10); break;
        case "l": case "L": seekBy(10); break;
        case "k": case "K": case " ": e.preventDefault(); togglePlay(); break;
        case "m": case "M": toggleMute(); break;
        case "f": case "F": toggleFullscreen(); break;
        case "t": case "T": setIsTheater((prev) => !prev); break;
        case "i": case "I": togglePiP(); break;
        case "c": case "C":
          if (subtitles.length > 0) {
            setActiveSubId((prev) => (prev === null ? subtitles[0].fileId : null));
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isIframe, seekBy, seekTo, duration, changeVolume, volume, togglePlay, toggleMute, toggleFullscreen, togglePiP, subtitles]);

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
      className={`${
        isFullscreen
          ? "fixed inset-0 z-[99999] w-screen h-[100dvh] max-h-none rounded-none aspect-auto bg-black"
          : `relative w-full aspect-video ${isTheater ? "max-h-[88vh]" : "max-h-[76vh]"} bg-black rounded-lg`
      } overflow-hidden select-none transition-all duration-300 ${
        isPro ? "shadow-[0_0_50px_rgba(245,158,11,0.18)] ring-1 ring-amber-500/30" : "shadow-[0_20px_70px_rgba(0,0,0,0.95)]"
      } group/container ${
        !controlsVisible && isPlaying ? "cursor-none" : "cursor-default"
      }`}
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
            className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
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
          {/* ─── VIDEO NATIVE ─── */}
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

          {/* ─── YouTube Buffering Spinner ─── */}
          {isBuffering && hasStarted && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-[#ff0000] border-r-[#ff0000] animate-spin" />
            </div>
          )}

          {/* ─── Center Feedback Animation Overlay (YouTube Style) ─── */}
          {centerFeedback && (
            <div
              key={centerFeedback.key}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center animate-in fade-in zoom-in-90 duration-150"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-2xl">
                {centerFeedback.icon === "play" && (
                  <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white translate-x-0.5"><path d="M8 5v14l11-7z" /></svg>
                )}
                {centerFeedback.icon === "pause" && (
                  <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                )}
                {centerFeedback.icon === "forward" && (
                  <div className="flex flex-col items-center">
                    <IconPlayerSkipForward className="w-7 h-7" />
                    <span className="text-[10px] font-bold mt-0.5">+5s</span>
                  </div>
                )}
                {centerFeedback.icon === "backward" && (
                  <div className="flex flex-col items-center">
                    <IconPlayerSkipBack className="w-7 h-7" />
                    <span className="text-[10px] font-bold mt-0.5">-5s</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── YOUTUBE CONTROLS OVERLAY ─── */}
          <div
            className={`absolute inset-0 z-20 flex flex-col justify-between pointer-events-none transition-opacity duration-200 ${
              controlsVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* ── Top bar: Title, PRO VIP Badge & P2P ── */}
            <div className="pointer-events-auto flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
              <div className="flex items-center gap-2">

                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-bold text-white drop-shadow truncate max-w-xs sm:max-w-md">
                    {item.title}
                  </span>
                  {currentEpisode && (
                    <span className="text-xs text-white/70 font-medium">
                      S{String(currentEpisode.season ?? 1).padStart(2, "0")}E{String(currentEpisode.number).padStart(2, "0")} · {currentEpisode.title}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Bouton Lecteur Réduit / Navigation flottante comme YouTube (PiP) */}
                <button
                  type="button"
                  onClick={togglePiP}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-lg"
                  title="Lecteur réduit / Naviguer en regardant (PiP)"
                >
                  <IconPictureInPicture className="w-4 h-4 text-[#D70466]" />
                  <span className="text-[11px] font-medium hidden sm:inline">Lecteur réduit</span>
                </button>

                {canP2P && hasStarted && ["fetching", "scanning", "connecting"].includes(p2p.status) && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#22d3ee] bg-black/60 border border-[#22d3ee]/30 rounded-full px-2.5 py-1">
                    <IconLoader2 className="h-3 w-3 animate-spin" />
                    P2P…
                  </span>
                )}
                {canP2P && p2pActive && (
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-black/60 border border-emerald-400/30 rounded-full px-2.5 py-1">
                    P2P · {p2p.peers} pairs · {formatSpeed(p2p.downloadSpeed)}
                  </span>
                )}
              </div>
            </div>

            {/* ── Center click zone ── */}
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

            {/* ── Bottom YouTube Control Bar ── */}
            <div className="pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8 pb-2 px-3 sm:px-4 space-y-1">
              {/* ── 1. YouTube Timeline / Scrubber ── */}
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
                {/* Floating Timestamp Tooltip */}
                {hoverTime !== null && (
                  <div
                    className="absolute -top-7 px-2 py-0.5 rounded bg-black/85 text-white text-[11px] font-semibold tracking-wide pointer-events-none -translate-x-1/2 shadow z-30"
                    style={{ left: hoverPos }}
                  >
                    {formatTime(hoverTime)}
                  </div>
                )}

                {/* Progress Track */}
                <div className="relative w-full h-[3px] group-hover/timeline:h-[5px] transition-all duration-100 bg-white/20">
                  {/* Buffered Track */}
                  <div
                    className="absolute inset-y-0 left-0 bg-white/40 pointer-events-none transition-all duration-200"
                    style={{ width: `${bufferedPct}%` }}
                  />
                  {/* Played Track (Red) */}
                  <div
                    className="absolute inset-y-0 left-0 bg-[#ff0000]"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
                  >
                    {/* YouTube Red Thumb Playhead */}
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#ff0000] scale-0 group-hover/timeline:scale-100 transition-transform duration-100 shadow" />
                  </div>
                </div>
              </div>

              {/* ── 2. YouTube Controls Row ── */}
              <div className="flex items-center justify-between">
                {/* ── Left Controls: Play/Pause, Next, Volume, Time ── */}
                <div className="flex items-center gap-1 sm:gap-2">
                  {/* Play/Pause Button */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="group/btn relative p-2 text-white hover:text-white transition-opacity flex items-center justify-center"
                  >
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><path d="M8 5v14l11-7z" /></svg>
                    )}
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
                      {isPlaying ? "Pause (k)" : "Lire (k)"}
                    </span>
                  </button>

                  {/* Volume with Smooth Hover Expand Slider - hidden on mobile */}
                  <div className="hidden sm:flex items-center group/vol relative">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="group/btn relative p-2 text-white hover:text-white transition-opacity flex items-center justify-center"
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
                      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
                        {isMuted ? "Activer le son (m)" : "Désactiver le son (m)"}
                      </span>
                    </button>

                    {/* Expandable Slider */}
                    <div className="overflow-hidden transition-all duration-200 w-0 group-hover/vol:w-14 sm:group-hover/vol:w-16 flex items-center ml-0.5">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => changeVolume(Number(e.target.value))}
                        className="w-14 sm:w-16 h-1 accent-[#ff0000] cursor-pointer appearance-none rounded-full bg-white/30"
                      />
                    </div>
                  </div>

                  {/* Real-time Time Display (YouTube Format) */}
                  <span className="text-[11px] sm:text-[13px] font-sans text-white/90 select-none ml-1 tabular-nums whitespace-nowrap">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* ── Right Controls: Autoplay, CC, Settings, PiP, Theater, Fullscreen ── */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {/* Autoplay Pill Switch - hidden on mobile */}
                  <button
                    type="button"
                    onClick={() => setAutoplay(!autoplay)}
                    className="hidden sm:flex group/btn relative p-2 items-center"
                  >
                    <div className={`w-9 h-4 rounded-full p-0.5 transition-colors relative flex items-center ${autoplay ? "bg-white/40" : "bg-white/20"}`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform flex items-center justify-center shadow ${autoplay ? "translate-x-4 bg-white text-zinc-900" : "translate-x-0 bg-white/70 text-zinc-800"}`}>
                        {autoplay ? (
                          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-zinc-900"><path d="M8 5v14l11-7z" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-2 h-2 fill-zinc-800"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                        )}
                      </div>
                    </div>
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity z-30">
                      Lecture automatique {autoplay ? "activée" : "désactivée"}
                    </span>
                  </button>

                  {/* Closed Captions [CC] - hidden on mobile (accessible via Settings) */}
                  {subtitles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeSubId !== null) setActiveSubId(null);
                        else setActiveSubId(subtitles[0].fileId);
                      }}
                      className="hidden sm:flex group/btn relative p-2 text-white hover:text-white transition-opacity flex-col items-center justify-center"
                    >
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                        <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
                      </svg>
                      {activeSubId !== null && (
                        <div className="w-5 h-0.5 bg-[#ff0000] -mt-0.5 rounded-full" />
                      )}
                      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity z-30">
                        Sous-titres (c)
                      </span>
                    </button>
                  )}

                  {/* Settings Gear with YouTube Menu Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSpeedMenu(!showSpeedMenu);
                        setSettingsTab("main");
                        setShowQualityMenu(false);
                        setShowSubMenu(false);
                      }}
                      className="group/btn relative p-2 text-white hover:text-white transition-opacity flex items-center justify-center"
                    >
                      <svg viewBox="0 0 24 24" className={`w-6 h-6 fill-white transition-transform duration-300 ${showSpeedMenu ? "rotate-45" : ""}`}>
                        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                      </svg>
                      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity z-30">
                        Paramètres
                      </span>
                    </button>

                    {/* YouTube Settings Popover */}
                    {showSpeedMenu && (
                      <div className="absolute bottom-full right-0 mb-3 w-60 sm:w-56 max-w-[calc(100vw-24px)] py-1.5 bg-[#1f1f1f]/95 backdrop-blur-md rounded-xl shadow-2xl text-white text-xs z-50 animate-in fade-in zoom-in-95 duration-100 border border-white/10">
                        {settingsTab === "main" && (
                          <div className="flex flex-col">
                            {/* Autoplay inside settings for mobile */}
                            <button
                              onClick={() => setAutoplay(!autoplay)}
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors text-left"
                            >
                              <span className="text-zinc-300">Lecture auto</span>
                              <span className={`font-semibold ${autoplay ? "text-[#D70466]" : "text-zinc-400"}`}>
                                {autoplay ? "Activée" : "Désactivée"}
                              </span>
                            </button>

                            {/* Speed */}
                            <button
                              onClick={() => setSettingsTab("speed")}
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors text-left border-t border-white/5"
                            >
                              <span className="text-zinc-300">Vitesse de lecture</span>
                              <span className="text-zinc-400 font-medium">{playbackRate === 1 ? "Normale" : `${playbackRate}x`} ›</span>
                            </button>

                            {/* Quality */}
                            {qualityLevels.length > 0 && (
                              <button
                                onClick={() => setSettingsTab("quality")}
                                className="px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors text-left border-t border-white/5"
                              >
                                <span className="text-zinc-300">Qualité</span>
                                <span className="text-zinc-400 font-medium truncate max-w-[100px] text-right">
                                  {currentQuality === -1 ? "Auto" : qualityLevels.find((q) => q.index === currentQuality)?.label || "HD"} ›
                                </span>
                              </button>
                            )}

                            {/* Subtitles */}
                            {subtitles.length > 0 && (
                              <button
                                onClick={() => setSettingsTab("subtitles")}
                                className="px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors text-left border-t border-white/5"
                              >
                                <span className="text-zinc-300">Sous-titres</span>
                                <span className="text-zinc-400 font-medium truncate max-w-[100px] text-right">
                                  {activeSubId === null ? "Désactivés" : subtitles.find((s) => s.fileId === activeSubId)?.langName || "Actifs"} ›
                                </span>
                              </button>
                            )}

                            {/* Picture-in-Picture on mobile */}
                            <button
                              onClick={() => { togglePiP(); setShowSpeedMenu(false); }}
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-white/10 transition-colors text-left border-t border-white/5 sm:hidden"
                            >
                              <span className="text-zinc-300">Lecteur réduit (PiP)</span>
                              <span className="text-zinc-400 font-medium">Activer</span>
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
                                onClick={() => {
                                  changePlaybackRate(rate);
                                  setShowSpeedMenu(false);
                                }}
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

                        {settingsTab === "quality" && (
                          <div className="flex flex-col">
                            <button
                              onClick={() => setSettingsTab("main")}
                              className="px-4 py-2 flex items-center gap-2 text-zinc-400 hover:text-white border-b border-white/10 font-bold"
                            >
                              ‹ Qualité
                            </button>
                            <button
                              onClick={() => {
                                changeQuality(-1);
                                setShowSpeedMenu(false);
                              }}
                              className={`px-4 py-2 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${
                                currentQuality === -1 ? "text-[#ff0000] font-bold" : "text-white"
                              }`}
                            >
                              <span>Automatique {isLowBandwidth && "(Éco)"}</span>
                              {currentQuality === -1 && <span>✓</span>}
                            </button>
                            {qualityLevels.map((lvl) => (
                              <button
                                key={lvl.index}
                                onClick={() => {
                                  changeQuality(lvl.index);
                                  setShowSpeedMenu(false);
                                }}
                                className={`px-4 py-2 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${
                                  currentQuality === lvl.index ? "text-[#ff0000] font-bold" : "text-white"
                                }`}
                              >
                                <span>{lvl.label}</span>
                                {currentQuality === lvl.index && <span>✓</span>}
                              </button>
                            ))}
                          </div>
                        )}

                        {settingsTab === "subtitles" && (
                          <div className="flex flex-col">
                            <button
                              onClick={() => setSettingsTab("main")}
                              className="px-4 py-2 flex items-center gap-2 text-zinc-400 hover:text-white border-b border-white/10 font-bold"
                            >
                              ‹ Sous-titres
                            </button>
                            <button
                              onClick={() => {
                                setActiveSubId(null);
                                setShowSpeedMenu(false);
                              }}
                              className={`px-4 py-2 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${
                                activeSubId === null ? "text-[#ff0000] font-bold" : "text-white"
                              }`}
                            >
                              <span>Désactivés</span>
                              {activeSubId === null && <span>✓</span>}
                            </button>
                            {subtitles.map((sub) => (
                              <button
                                key={sub.fileId}
                                onClick={() => {
                                  setActiveSubId(sub.fileId);
                                  setShowSpeedMenu(false);
                                }}
                                className={`px-4 py-2 text-left flex items-center justify-between hover:bg-white/10 transition-colors ${
                                  activeSubId === sub.fileId ? "text-[#ff0000] font-bold" : "text-white"
                                }`}
                              >
                                <span>{sub.langName || sub.lang.toUpperCase()}</span>
                                {activeSubId === sub.fileId && <span>✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Miniplayer (Picture-in-Picture) */}
                  <button
                    type="button"
                    onClick={togglePiP}
                    className="flex group/btn relative p-2 text-white hover:text-white transition-opacity items-center justify-center cursor-pointer"
                    title="Lecteur réduit (PiP)"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                      <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" />
                    </svg>
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity z-30">
                      Lecteur réduit (i)
                    </span>
                  </button>

                  {/* Theater Mode - visible on lg: */}
                  <button
                    type="button"
                    onClick={() => setIsTheater(!isTheater)}
                    className="hidden lg:flex group/btn relative p-2 text-white hover:text-white transition-opacity items-center justify-center"
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                      <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z" />
                    </svg>
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity z-30">
                      Mode cinéma (t)
                    </span>
                  </button>

                  {/* Fullscreen */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="group/btn relative p-2 text-white hover:text-white transition-opacity flex items-center justify-center"
                    aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                  >
                    {isFullscreen ? (
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                      </svg>
                    )}
                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity z-30">
                      {isFullscreen ? "Quitter le plein écran (f)" : "Plein écran (f)"}
                    </span>
                  </button>
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/30" />

          {/* Top Bar on Cover */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 hover:bg-white/20 backdrop-blur-xl border border-white/10 text-white/90 hover:text-white transition-all shadow-xl hover:scale-105 active:scale-95 group"
              title="Retour"
            >
              <IconArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="text-xs font-bold tracking-wide">Retour</span>
            </button>
          </div>

          <div className="relative z-10 h-full w-full flex flex-col items-center justify-center px-6 text-center">
            {item.type && (
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest bg-white/10 text-white/90 border border-white/15 backdrop-blur-md">
                  {item.type === "series" ? "Série" : item.type === "anime" ? "Anime" : "Film"}
                </span>
              </div>
            )}

            <h2 className="block max-w-3xl text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)] [overflow-wrap:anywhere]">
              {item.title}
            </h2>
            {currentEpisode && (
              <p className="mt-2 block max-w-2xl text-sm sm:text-base text-white/90 font-semibold drop-shadow-md">
                Saison {currentEpisode.season ?? 1} · Épisode {currentEpisode.number} : {currentEpisode.title}
              </p>
            )}

            <div className="mt-6 sm:mt-8 relative">
              {/* Breathing aura */}
              <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#D70466] to-[#7C3AED] opacity-40 blur-xl animate-pulse pointer-events-none" />
              
              <button
                type="button"
                onClick={startPlayback}
                aria-label="Lire la vidéo"
                className="group/play relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-[#D70466] to-[#7C3AED] shadow-[0_0_40px_rgba(215,4,102,0.6)] ring-4 ring-white/20 transition-all duration-300 hover:scale-110 active:scale-95 text-white"
              >
                <IconPlayerPlay className="h-9 w-9 sm:h-11 sm:w-11 translate-x-0.5 drop-shadow-lg" fill="currentColor" />
              </button>
            </div>

            <p className="mt-4 block text-[11px] sm:text-xs text-white/60 font-semibold tracking-widest uppercase">
              Cliquez pour lancer le visionnage
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
