"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
// Type-only : hls.js (~530 Ko) est importé dynamiquement dans l'effet HLS.
import type Hls from "hls.js";
import { useLanguage } from "@/i18n/LanguageContext";
import type { LiveChannel } from "@/types/live";
import { PopupFirewall } from "@/lib/PopupFirewall";
import { enterFullscreen, exitFullscreen, isFullscreenActive } from "@/lib/fullscreen";
import { ArrowLeft, X, Play, Pause, ArrowsClockwise, SpeakerSimpleHigh, SpeakerSimpleSlash, ArrowsOutSimple, ArrowsInSimple, Television, PictureInPicture, ShareNetwork, Check } from "@phosphor-icons/react";

interface LivePlayerProps {
  channel: LiveChannel;
  allChannels?: LiveChannel[];
  onBack: () => void;
  onSelectChannel?: (ch: LiveChannel) => void;
  /** Remplit entièrement l'écran (page player plein écran) au lieu d'un ratio 16:9 */
  fill?: boolean;
  // La page hôte affiche déjà sa propre barre du haut : ne pas empiler deux chromes
  hideTopBar?: boolean;
  /** Called after the active HLS source exhausted its recovery attempts. */
  onPlaybackError?: (reason: string) => void;
}

const PROXY_BASE = "/api/live/proxy";

/* Contrôles « Apple TV » : verre dépoli, cercles, bordure blanche discrète. */
const GLASS_BTN =
  "flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/90 hover:text-white hover:bg-white/20 transition-colors";
const GLASS_PILL =
  "inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/90 hover:text-white hover:bg-white/20 transition-colors";

function buildProxyUrl(url: string): string {
  if (!url) return "";
  if (url.includes("/api/live/proxy")) return url;
  return `${PROXY_BASE}?url=${encodeURIComponent(url)}`;
}

// Construit le loader proxy à partir du module hls.js (importé dynamiquement) :
// toute requête fragment/manifest passe par /api/live/proxy pour les CDN
// soumis à anti-leech (Referer) ou bloqués en CORS.
function buildProxiedLoader(HlsModule: typeof Hls) {
  const BaseLoader: any = (HlsModule as any).DefaultConfig?.loader;
  if (!BaseLoader) return null;
  return class ProxiedHlsLoader extends BaseLoader {
    load(context: any, config: any, callbacks: any) {
      if (context?.url && !context.url.includes("/api/live/proxy")) {
        context.url = buildProxyUrl(context.url);
      }
      super.load(context, config, callbacks);
    }
  };
}

/** Composant Logo avec fallback élégant pour ne jamais casser l'interface */
export function ChannelLogoBadge({
  logo,
  name,
  className = "h-7 w-auto max-w-[80px]",
  fallbackClassName = "w-8 h-7",
}: {
  logo?: string;
  name: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logo]);

  const initials = name
    .replace(/^bein\s+sports/i, "beIN")
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "TV";

  if (!logo || hasError) {
    return (
      <div
        className={`${fallbackClassName} rounded bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-300 shrink-0 shadow-sm`}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`${className} px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0 overflow-hidden`}
    >
      <img
        src={logo}
        alt={name}
        className="h-full w-auto object-contain max-h-5"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export default function LivePlayer({
  channel,
  allChannels = [],
  onBack,
  onSelectChannel,
  fill = false,
  hideTopBar = false,
  onPlaybackError,
}: LivePlayerProps) {
  const { translate: _ } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [liveProgress, setLiveProgress] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showChannelDrawer, setShowChannelDrawer] = useState(false);
  const onPlaybackErrorRef = useRef(onPlaybackError);

  const [error, setError] = useState<string | null>(null);
  const [proxyMode, setProxyMode] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const isHls = channel.type === "hls";

  useEffect(() => {
    onPlaybackErrorRef.current = onPlaybackError;
  }, [onPlaybackError]);

  const iframeSrc =
    channel.type === "youtube" && channel.ytVideoId
      ? `https://www.youtube-nocookie.com/embed/${channel.ytVideoId}?autoplay=1&muted=0&rel=0&modestbranding=1&playsinline=1`
      : channel.type === "dailymotion" && channel.ytVideoId
        ? `https://www.dailymotion.com/embed/video/${channel.ytVideoId}?autoplay=1&muted=0`
        : null;

  // Détection dynamique de l'état LIVE (en direct vs différé/pause)
  const updateLiveState = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    if (el.paused) {
      setIsLive(false);
      return;
    }

    if (el.seekable && el.seekable.length > 0) {
      const end = el.seekable.end(el.seekable.length - 1);
      const start = el.seekable.start(0);
      const current = el.currentTime;
      const delay = end - current;

      // Si le retard sur le flux direct est inférieur à 6 secondes, on est en LIVE
      const atLiveEdge = delay <= 6;
      setIsLive(atLiveEdge);

      const totalDuration = end - start;
      if (totalDuration > 0) {
        const pct = Math.min(100, Math.max(0, ((current - start) / totalDuration) * 100));
        setLiveProgress(pct);
      } else {
        setLiveProgress(100);
      }
    } else {
      // Flux continu direct sans seekable buffer
      setIsLive(!el.paused);
      setLiveProgress(100);
    }
  }, []);

  // Gestion de la disparition automatique des contrôles
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showChannelDrawer) {
        setShowControls(false);
      }
    }, 4000);
  };

  // Active le pare-feu anti-pub PopupFirewall tant que le player est actif
  useEffect(() => {
    PopupFirewall.activate();
    return () => {
      PopupFirewall.deactivate();
    };
  }, []);

  /* ───────── HLS lifecycle ───────── */
  useEffect(() => {
    const el = videoRef.current;
    if (!isHls) return;
    if (!channel.streamUrl) {
      setError("no-stream");
      return;
    }
    if (!el) return;

    setError(null);
    setIsLoading(true);
    setIsLive(true);
    setLiveProgress(100);

    const lowLatency = true;
    const config: any = {
      enableWorker: true,
      lowLatencyMode: lowLatency,
      maxBufferLength: lowLatency ? 15 : 30,
      maxMaxBufferLength: lowLatency ? 30 : 60,
      backBufferLength: lowLatency ? 0 : 2,
      maxLoadingDelay: 2,
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 4,
      levelLoadingMaxRetry: 6,
      startLevel: -1,
      abrEwmaDefaultEstimate: 1_200_000,
      liveSyncDurationCount: lowLatency ? 1 : 3,
      liveMaxLatencyDurationCount: lowLatency ? 3 : 6,
      maxLiveSyncPlaybackRate: 1.12,
    };
    const isCorsRestricted = Boolean(
      (channel as any).proxy ||
      channel.streamUrl?.includes('amagi.tv') ||
      channel.streamUrl?.includes('wurl.com') ||
      channel.streamUrl?.includes('edgesuite.net')
    );

    const effectiveUrl = (proxyMode || isCorsRestricted)
      ? buildProxyUrl(channel.streamUrl)
      : channel.streamUrl;

    const startPlayback = () => {
      setIsLoading(false);
      el.muted = isMuted;
      el.play().catch(() => {});
      setIsPlaying(true);
      setIsLive(true);
      if (el.seekable && el.seekable.length > 0) {
        const liveEdge = el.seekable.end(el.seekable.length - 1);
        if (liveEdge > 0) {
          el.currentTime = Math.max(0, liveEdge - (lowLatency ? 1 : 2));
        }
      }
    };

    let cancelled = false;
    let hls: Hls | null = null;
    let failureReported = false;
    const reportFailure = (reason: string) => {
      if (failureReported) return;
      failureReported = true;
      onPlaybackErrorRef.current?.(reason);
    };
    let playbackTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePlaybackWatchdog = () => {
      if (playbackTimer) clearTimeout(playbackTimer);
      playbackTimer = setTimeout(() => {
        setError("stream");
        reportFailure("Aucun nouveau segment vidéo reçu depuis 20 secondes");
      }, 20_000);
    };
    schedulePlaybackWatchdog();

    // Import à la demande de hls.js (~530 Ko) : jamais dans le bundle initial.
    void (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if ((proxyMode || isCorsRestricted) && Hls.DefaultConfig?.loader) {
        const ProxiedHlsLoader = buildProxiedLoader(Hls);
        if (ProxiedHlsLoader) {
          config.loader = ProxiedHlsLoader;
          config.pLoader = ProxiedHlsLoader;
        }
      }

      if (Hls.isSupported()) {
        hls = new Hls(config);
        hls.loadSource(effectiveUrl);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
        hls.on(Hls.Events.FRAG_LOADED, () => {
          schedulePlaybackWatchdog();
          setIsLoading(false);
          updateLiveState();
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data?.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (!proxyMode) {
              setProxyMode(true);
              return;
            }
            hls?.startLoad();
            return;
          }
          setError("stream");
          reportFailure("Le flux HLS ne répond plus");
        });
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = effectiveUrl;
        el.addEventListener("loadedmetadata", () => {
          schedulePlaybackWatchdog();
          startPlayback();
        });
        el.addEventListener("timeupdate", schedulePlaybackWatchdog);
        el.addEventListener("error", () => {
          if (!proxyMode) {
            setProxyMode(true);
          } else {
            setError("stream");
            reportFailure("Le flux HLS ne répond plus");
          }
        });
      } else {
        setError("unsupported");
        if (playbackTimer) clearTimeout(playbackTimer);
        reportFailure("HLS non supporté par ce navigateur");
      }
    })();

    return () => {
      cancelled = true;
      if (playbackTimer) clearTimeout(playbackTimer);
      el.removeEventListener("timeupdate", schedulePlaybackWatchdog);
      if (hls) hls.destroy();
    };
  }, [isHls, channel.streamUrl, proxyMode, isMuted, updateLiveState]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(isFullscreenActive());
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    const video = videoRef.current;
    video?.addEventListener("webkitbeginfullscreen", handleFsChange);
    video?.addEventListener("webkitendfullscreen", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      video?.removeEventListener("webkitbeginfullscreen", handleFsChange);
      video?.removeEventListener("webkitendfullscreen", handleFsChange);
    };
  }, [iframeSrc]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
      updateLiveState();
    } else {
      el.pause();
      setIsPlaying(false);
      setIsLive(false);
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  };

  const handleShare = async () => {
    const title = channel.name || "CHILLERS";
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      throw new Error("no-web-share");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        setError("Impossible de partager le lien");
      }
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (isFullscreen || isFullscreenActive()) {
      await exitFullscreen(videoRef.current).catch(() => {});
    } else {
      const entered = await enterFullscreen(containerRef.current, videoRef.current);
      setIsFullscreen(entered);
    }
  };

  const seekRelative = (seconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime + seconds);
    updateLiveState();
  };

  // Revenir au direct instantanément
  const jumpToLive = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.seekable && el.seekable.length > 0) {
      el.currentTime = el.seekable.end(el.seekable.length - 1) - 0.5;
    }
    if (el.paused) {
      el.play().catch(() => {});
    }
    setIsPlaying(true);
    setIsLive(true);
    setLiveProgress(100);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || !el.seekable || el.seekable.length === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const start = el.seekable.start(0);
    const end = el.seekable.end(el.seekable.length - 1);
    const targetTime = start + clickRatio * (end - start);

    el.currentTime = targetTime;
    updateLiveState();
  };

  const togglePictureInPicture = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await el.requestPictureInPicture();
      }
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
          if (!showChannelDrawer) {
            setShowControls(false);
          }
        }, 4000);
      }}
      className={`relative w-full bg-black overflow-hidden select-none group font-sans text-white ${
        isFullscreen
          ? "fixed inset-0 z-[9999] h-dvh w-screen max-h-none"
          : fill
            ? "h-full w-full"
            : "min-h-[200px] sm:min-h-[340px] aspect-video max-h-[75dvh]"
      }`}
    >
      {/* Marque permanente : indépendante de l'apparition des commandes. */}
      <div className="pointer-events-none absolute right-[calc(env(safe-area-inset-right,0px)+0.75rem)] top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 flex items-center rounded-full border border-white/10 bg-black/55 px-2.5 py-1 backdrop-blur-md shadow-lg">
        <img
          src="/favicon-32x32.png"
          alt="CHILLERS"
          width={28}
          height={28}
          loading="eager"
          decoding="async"
          className="h-6 w-6 shrink-0 object-contain drop-shadow-[0_0_10px_rgba(215,4,102,0.5)]"
        />
        <span className="-ml-1.5 text-sm font-isometra tracking-tight text-white">
          HILL<span className="text-brand-primary">ERS</span>
        </span>
      </div>

      {/* ── Main Video Layer ────────────────────────────────────── */}
      {iframeSrc ? (
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          className="absolute inset-0 w-full h-full border-none bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; gyroscope; accelerometer; clipboard-write"
          referrerPolicy="no-referrer"
          title={channel.name}
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer"
          playsInline
          preload="auto"
          onClick={togglePlay}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setIsPlaying(true);
            updateLiveState();
          }}
          onCanPlay={() => setIsLoading(false)}
          onTimeUpdate={updateLiveState}
          onPause={() => {
            setIsPlaying(false);
            setIsLive(false);
          }}
          onSeeking={updateLiveState}
          onSeeked={updateLiveState}
        />
      )}

      {/* ── Central Circular Spinner (Canal+ Style) ─────────────── */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-[3.5px] border-white/10 border-t-red-600 border-r-red-500 animate-spin" />
        </div>
      )}

      {/* ── Error Screen ────────────────────────────────────────── */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Television className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white">Flux momentanément indisponible</h3>
          <p className="text-sm text-zinc-400 max-w-md">
            La chaîne {channel.name} est en cours d'actualisation ou le signal source est interrompu.
          </p>
        </div>
      )}

      {/* ── TOP BAR OVERLAY (Canal+ Style) ──────────────────────── */}
      <div
        className={`absolute top-0 inset-x-0 z-30 pt-[calc(1rem_+_env(safe-area-inset-top,0px))] pb-4 pl-[calc(1rem_+_env(safe-area-inset-left,0px))] pr-[calc(1rem_+_env(safe-area-inset-right,0px))] bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          hideTopBar ? "hidden" : showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Gauche : Retour + Marque CHILLERS + Titre chaîne */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={onBack}
              className={`${GLASS_BTN} w-11 h-11 shrink-0`}
              aria-label="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-white truncate">
                {channel.name}
              </h1>
              <p className="flex items-center gap-1.5 text-[11px] sm:text-xs text-white/60 font-medium truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isLive ? "bg-red-500 animate-pulse" : "bg-zinc-500"
                  }`}
                />
                {isLive ? "En direct" : "Différé"}
              </p>
            </div>
          </div>

          {/* Droite : Logo chaîne + Volume + PiP + Partager */}
          <div className="mr-28 flex shrink-0 items-center gap-2 sm:gap-3">
            <ChannelLogoBadge
              logo={channel.logo}
              name={channel.name}
              className="h-7 w-auto max-w-[80px]"
              fallbackClassName="w-8 h-7"
            />

            <button
              onClick={toggleMute}
              className={`${GLASS_BTN} w-11 h-11`}
              aria-label="Volume"
            >
              {isMuted ? (
                <SpeakerSimpleSlash className="h-5 w-5 text-red-500" />
              ) : (
                <SpeakerSimpleHigh className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={togglePictureInPicture}
              className={`${GLASS_BTN} w-11 h-11 hidden sm:flex`}
              aria-label="Picture-in-Picture"
              title="Mini-lecteur"
            >
              <PictureInPicture className="h-5 w-5" />
            </button>

            <button
              onClick={handleShare}
              className={`${GLASS_BTN} w-11 h-11`}
              aria-label="Partager"
              title={shareCopied ? "Lien copié !" : "Partager"}
            >
              {shareCopied ? (
                <Check className="h-5 w-5 text-brand-primary" />
              ) : (
                <ShareNetwork className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR OVERLAY (Canal+ Style) ───────────────────── */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 pt-8 pb-[calc(0.75rem_+_env(safe-area-inset-bottom,0px))] sm:pb-4 pl-[calc(1rem_+_env(safe-area-inset-left,0px))] pr-[calc(1rem_+_env(safe-area-inset-right,0px))] bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 space-y-2.5 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Barre de timeline en direct (interactive) */}
        <div
          onClick={handleTimelineClick}
          className="relative w-full h-1 rounded-full overflow-hidden cursor-pointer bg-white/15 backdrop-blur-md"
        >
          <div
            style={{ width: `${liveProgress}%` }}
            className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-150 ${
              isLive
                ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"
                : "bg-white/80"
            }`}
          />
        </div>

        {/* Ligne des contrôles */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Gauche : -10s, Lecture/Pause, +10s, LIVE */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => seekRelative(-10)}
              className={`${GLASS_BTN} w-11 h-11 hidden sm:flex`}
              aria-label="Reculer de 10s"
              title="Reculer de 10s"
            >
              <ArrowsClockwise className="h-5 w-5" />
            </button>

            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white transition-all transform hover:scale-105 active:scale-95"
              aria-label={isPlaying ? "Pause" : "Lecture"}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 fill-white" />
              ) : (
                <Play className="h-6 w-6 fill-white ml-0.5" />
              )}
            </button>

            <button
              onClick={() => seekRelative(10)}
              className={`${GLASS_BTN} w-11 h-11 hidden sm:flex`}
              aria-label="Avancer de 10s"
              title="Avancer de 10s"
            >
              <ArrowsClockwise className="h-5 w-5" />
            </button>

            <button
              onClick={jumpToLive}
              title={isLive ? "Vous êtes en direct" : "Cliquer pour revenir au direct"}
              className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all duration-200 backdrop-blur-md border ${
                isLive
                  ? "bg-red-600 border-red-500 text-white shadow-md shadow-red-600/30 cursor-default"
                  : "bg-white/10 border-white/15 text-white/70 hover:text-white hover:bg-white/20 cursor-pointer"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isLive ? "bg-white animate-pulse" : "bg-zinc-500"
                }`}
              />
              LIVE
            </button>
          </div>

          {/* Droite : Chaînes, Plein écran */}
          <div className="flex items-center gap-2 sm:gap-3">
            {allChannels.length > 0 && (
              <button
                onClick={() => setShowChannelDrawer(!showChannelDrawer)}
                className={`${GLASS_PILL}`}
              >
                <Television className="h-4 w-4" />
                <span className="hidden sm:inline">Chaînes</span>
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className={`${GLASS_BTN} w-11 h-11`}
              aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? (
                <ArrowsInSimple className="h-5 w-5" />
              ) : (
                <ArrowsOutSimple className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── CHANNEL DRAWER OVERLAY (TOUTES LES CHAÎNES) ──────────── */}
      {showChannelDrawer && (
        <div className="absolute inset-y-0 right-0 z-40 w-80 sm:w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 flex flex-col p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom,0px))] animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Television className="h-4 w-4 text-red-500" />
              Toutes les chaînes
            </h3>
            <button
              onClick={() => setShowChannelDrawer(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {allChannels.map((ch) => {
              const isCurrent = ch.slug === channel.slug;
              return (
                <div
                  key={ch.slug}
                  onClick={() => {
                    if (onSelectChannel) onSelectChannel(ch);
                    setShowChannelDrawer(false);
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                    isCurrent
                      ? "bg-red-600/20 border border-red-500/40 text-white shadow-lg"
                      : "bg-zinc-900/60 hover:bg-zinc-800/80 border border-transparent text-zinc-300"
                  }`}
                >
                  <ChannelLogoBadge
                    logo={ch.logo}
                    name={ch.name}
                    className="h-7 w-10"
                    fallbackClassName="w-10 h-7"
                  />

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{ch.name}</h4>
                    <span className="text-[10px] text-zinc-400 capitalize">
                      {ch.categories?.[0] || "Direct"}
                    </span>
                  </div>

                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
