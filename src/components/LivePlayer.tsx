"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useLanguage } from "@/i18n/LanguageContext";
import type { LiveChannel } from "@/types/live";
import {
  IconArrowLeft,
  IconX,
  IconPlayerPlay,
  IconPlayerPause,
  IconRotate2,
  IconRotateDot,
  IconVolume,
  IconVolumeOff,
  IconMaximize,
  IconMinimize,
  IconDeviceTv,
  IconClock,
  IconDotsVertical,
  IconPictureInPicture,
  IconRefresh,
  IconChevronRight,
} from "@tabler/icons-react";

interface LivePlayerProps {
  channel: LiveChannel;
  allChannels?: LiveChannel[];
  onBack: () => void;
  onSelectChannel?: (ch: LiveChannel) => void;
}

const PROXY_BASE = "/api/live/proxy";

function buildProxyUrl(url: string): string {
  return `${PROXY_BASE}?url=${encodeURIComponent(url)}`;
}

const BaseLoader: any = (Hls as any).DefaultConfig?.loader;

class ProxiedHlsLoader extends BaseLoader {
  load(context: any, config: any, callbacks: any) {
    if (context?.url) context.url = buildProxyUrl(context.url);
    super.load(context, config, callbacks);
  }
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
  const [showEpgModal, setShowEpgModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [proxyMode, setProxyMode] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const isHls = channel.type === "hls";

  const iframeSrc =
    channel.type === "youtube" && channel.ytVideoId
      ? `https://www.youtube-nocookie.com/embed/${channel.ytVideoId}?autoplay=1&muted=0&rel=0&modestbranding=1&playsinline=1`
      : channel.type === "dailymotion" && channel.ytVideoId
        ? `https://www.dailymotion.com/embed/video/${channel.ytVideoId}?autoplay=1&muted=0`
        : null;

  const retry = useCallback(() => {
    setError(null);
    setProxyMode(false);
    setIsLoading(true);
    setIsLive(true);
    setLiveProgress(100);
    setReloadKey((k) => k + 1);
  }, []);

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
      if (!showChannelDrawer && !showEpgModal && !showSettingsModal) {
        setShowControls(false);
      }
    }, 4000);
  };

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

    const config: any = {
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
      liveSyncDurationCount: 3,
    };
    if (proxyMode && BaseLoader) {
      config.loader = ProxiedHlsLoader;
      config.pLoader = ProxiedHlsLoader;
    }

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
    };

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls(config);
      hls.loadSource(effectiveUrl);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(Hls.Events.FRAG_LOADED, () => {
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
      });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = effectiveUrl;
      el.addEventListener("loadedmetadata", startPlayback);
      el.addEventListener("error", () => {
        if (!proxyMode) {
          setProxyMode(true);
        } else {
          setError("stream");
        }
      });
    } else {
      setError("unsupported");
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [isHls, channel.streamUrl, proxyMode, reloadKey, isMuted, updateLiveState]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

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

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
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
      className="relative w-full aspect-video bg-black overflow-hidden select-none group font-sans text-white"
    >
      {/* ── Main Video Layer ────────────────────────────────────── */}
      {iframeSrc ? (
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          className="absolute inset-0 w-full h-full border-none bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; gyroscope; accelerometer; clipboard-write"
          allowFullScreen
          referrerPolicy="origin"
          title={channel.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-orientation-lock allow-presentation"
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
            <IconDeviceTv className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white">Flux momentanément indisponible</h3>
          <p className="text-sm text-zinc-400 max-w-md">
            La chaîne {channel.name} est en cours d'actualisation ou le signal source est interrompu.
          </p>
          <button
            onClick={retry}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition-all"
          >
            <IconRefresh className="h-4 w-4" />
            Réessayer
          </button>
        </div>
      )}

      {/* ── TOP BAR OVERLAY (Canal+ Style) ──────────────────────── */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Gauche : Retour + Logo + Titre de la chaîne */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors"
              aria-label="Retour"
            >
              <IconArrowLeft className="h-5 w-5" />
            </button>

            <ChannelLogoBadge
              logo={channel.logo}
              name={channel.name}
              className="h-7 w-auto max-w-[80px]"
              fallbackClassName="w-8 h-7"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 cursor-pointer hover:text-red-400 transition-colors">
                <h1 className="text-sm sm:text-base md:text-lg font-black uppercase tracking-wider text-white truncate">
                  {channel.name}
                </h1>
                <IconChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate">
                {isLive ? "En direct HD" : "Différé"} · {channel.categories?.[0]?.toUpperCase() || "DIRECT"}
              </p>
            </div>
          </div>

          {/* Droite : Volume + PiP + Fermer */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={toggleMute}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              aria-label="Volume"
            >
              {isMuted ? (
                <IconVolumeOff className="h-5 w-5 text-red-500" />
              ) : (
                <IconVolume className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={togglePictureInPicture}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors hidden sm:block"
              aria-label="Picture-in-Picture"
              title="Mini-lecteur"
            >
              <IconPictureInPicture className="h-5 w-5" />
            </button>

            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              aria-label="Fermer"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR OVERLAY (Canal+ Style) ───────────────────── */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 pt-8 pb-3 sm:pb-4 px-4 sm:px-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 space-y-2.5 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Barre de timeline de diffusion en direct (interactive) */}
        <div className="space-y-1">
          <div
            onClick={handleTimelineClick}
            className="relative w-full h-1.5 sm:h-2 bg-zinc-800/90 rounded-full overflow-hidden cursor-pointer group/bar"
          >
            <div
              style={{ width: `${liveProgress}%` }}
              className={`absolute top-0 bottom-0 left-0 rounded-r-full transition-all duration-150 ${
                isLive
                  ? "bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.9)]"
                  : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
              }`}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-zinc-400 font-mono">
            <span>{isLive ? "En direct" : "En différé"}</span>
            <span className={isLive ? "text-red-500 font-bold" : "text-zinc-500"}>
              {isLive ? "LIVE HD" : "PAUSE / DIFFÉRÉ"}
            </span>
          </div>
        </div>

        {/* Ligne des contrôles */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Contrôles de gauche : -10s, Play/Pause, +10s, Bouton LIVE dynamique */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => seekRelative(-10)}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              aria-label="Reculer de 10s"
              title="Reculer de 10s"
            >
              <IconRotate2 className="h-5 w-5" />
            </button>

            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all transform hover:scale-105 active:scale-95"
              aria-label={isPlaying ? "Pause" : "Lecture"}
            >
              {isPlaying ? (
                <IconPlayerPause className="h-5 w-5 fill-white" />
              ) : (
                <IconPlayerPlay className="h-5 w-5 fill-white ml-0.5" />
              )}
            </button>

            <button
              onClick={() => seekRelative(10)}
              className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              aria-label="Avancer de 10s"
              title="Avancer de 10s"
            >
              <IconRotateDot className="h-5 w-5" />
            </button>

            {/* Bouton LIVE Canal+ : Rouge en direct, Gris si en pause/différé */}
            <button
              onClick={jumpToLive}
              title={isLive ? "Vous êtes en direct" : "Cliquer pour revenir au direct"}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-black uppercase tracking-wider transition-all duration-200 ml-1 ${
                isLive
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30 hover:bg-red-500 cursor-default"
                  : "bg-zinc-800/90 border border-white/15 text-zinc-400 hover:text-white hover:bg-zinc-700 hover:border-white/30 cursor-pointer"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLive ? "bg-white animate-pulse" : "bg-zinc-500"
                }`}
              />
              LIVE
            </button>
          </div>

          {/* Contrôles de droite : TOUTES LES CHAÎNES, REVOIR/À SUIVRE, Options, Plein écran */}
          <div className="flex items-center gap-2 sm:gap-4">
            {allChannels.length > 0 && (
              <button
                onClick={() => setShowChannelDrawer(!showChannelDrawer)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider transition-all"
              >
                <IconDeviceTv className="h-4 w-4" />
                <span className="hidden sm:inline">TOUTES LES CHAÎNES</span>
              </button>
            )}

            <button
              onClick={() => setShowEpgModal(!showEpgModal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all hidden md:flex"
            >
              <IconClock className="h-4 w-4" />
              <span>REVOIR / À SUIVRE</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(!showSettingsModal)}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
              aria-label="Options"
            >
              <IconDotsVertical className="h-5 w-5" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
              aria-label="Plein écran"
            >
              {isFullscreen ? (
                <IconMinimize className="h-5 w-5" />
              ) : (
                <IconMaximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── CHANNEL DRAWER OVERLAY (TOUTES LES CHAÎNES) ──────────── */}
      {showChannelDrawer && (
        <div className="absolute inset-y-0 right-0 z-40 w-80 sm:w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 flex flex-col p-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <IconDeviceTv className="h-4 w-4 text-red-500" />
              Toutes les chaînes
            </h3>
            <button
              onClick={() => setShowChannelDrawer(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              <IconX className="h-4 w-4" />
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
