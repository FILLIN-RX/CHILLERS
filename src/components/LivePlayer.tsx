"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useLanguage } from "@/i18n/LanguageContext";
import type { LiveChannel } from "@/types/live";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconVolume,
  IconVolumeOff,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";

interface LivePlayerProps {
  channel: LiveChannel;
  onBack: () => void;
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

export default function LivePlayer({ channel, onBack }: LivePlayerProps) {
  const { translate: _ } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyMode, setProxyMode] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const isHls = channel.type === "hls";

  const iframeSrc =
    channel.type === "youtube" && channel.ytVideoId
      ? `https://www.youtube-nocookie.com/embed/${channel.ytVideoId}?autoplay=1&muted=1&rel=0&modestbranding=1&playsinline=1`
      : channel.type === "dailymotion" && channel.ytVideoId
        ? `https://www.dailymotion.com/embed/video/${channel.ytVideoId}?autoplay=1&muted=1`
        : null;

  const retry = useCallback(() => {
    setError(null);
    setProxyMode(false);
    setIsLoading(true);
    setReloadKey((k) => k + 1);
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

    const startPlayback = () => {
      setIsLoading(false);
      el.muted = true;
      el.play().catch(() => {
        /* gesture-gated; ignored */
      });
    };

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls(config);
      hls.loadSource(channel.streamUrl);
      hls.attachMedia(el);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(Hls.Events.FRAG_LOADED, () => setIsLoading(false));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data?.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls?.recoverMediaError();
          return;
        }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (
            !proxyMode &&
            (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT)
          ) {
            setProxyMode(true);
            return;
          }
          hls?.startLoad();
          return;
        }
        setError("stream");
      });
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = channel.streamUrl;
      const onLoaded = startPlayback;
      const onError = () => setError("stream");
      el.addEventListener("loadedmetadata", onLoaded);
      el.addEventListener("error", onError);
      return () => {
        el.removeEventListener("loadedmetadata", onLoaded);
        el.removeEventListener("error", onError);
      };
    } else {
      setError("unsupported");
      return;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [isHls, channel.streamUrl, proxyMode, reloadKey]);

  /* ───────── controls ───────── */

  const handlePlayPause = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

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
        .catch(() => {});
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.tagName === "IFRAME") return;
      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === "KeyM") {
        toggleMute();
      } else if (e.code === "KeyF") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, toggleMute, toggleFullscreen]);

  /* ───────── render ───────── */

  const errorMessage =
    error === "no-stream"
      ? _("live.noStream")
      : error === "unsupported"
        ? _("live.unsupported")
        : _("live.streamUnavailable");

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black overflow-hidden select-none"
      onDoubleClick={toggleFullscreen}
    >
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
          className="absolute inset-0 w-full h-full object-contain bg-black"
          playsInline
          preload="auto"
          muted
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onCanPlay={() => setIsLoading(false)}
          onClick={handlePlayPause}
        />
      )}

      {/* Loading */}
      {isLoading && !error && isHls && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="h-10 w-10 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Error + retry */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
          <p className="font-medium text-lg text-white/90">{errorMessage}</p>
          <p className="text-sm text-white/50 max-w-md">
            {error === "stream" ? _("live.streamUnavailableDesc") : ""}
          </p>
          <button
            onClick={retry}
            className="flex items-center gap-2 px-5 py-2 rounded bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          >
            <IconRefresh className="h-4 w-4" />
            {_("live.retry")}
          </button>
        </div>
      )}

      {/* Top gradient + bar */}
      <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 to-transparent h-24 pointer-events-none" />
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            {_("live.liveLabel")}
          </span>
          <span className="text-sm sm:text-base md:text-lg font-black tracking-widest uppercase text-white truncate">
            {channel.name}
          </span>
        </div>
        <button
          onClick={onBack}
          className="p-1.5 text-white/70 hover:text-white transition-colors shrink-0"
          aria-label={_("live.backToLive")}
        >
          <IconX className="h-6 w-6" />
        </button>
      </div>

      {/* Unmute hint */}
      {!error && isPlaying && isMuted && isHls && (
        <button
          onClick={toggleMute}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-white/80 text-xs font-medium hover:bg-black/90 transition-colors"
        >
          <IconVolumeOff className="h-4 w-4" />
          {_("live.mutedHint")}
        </button>
      )}

      {/* Bottom gradient + controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent h-24 pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={handlePlayPause} className="text-white hover:text-white/80 transition-colors">
            {isPlaying ? <IconPlayerPause className="h-7 w-7" /> : <IconPlayerPlay className="h-7 w-7" />}
          </button>
          <div className="flex items-center gap-2 group/vol">
            <button onClick={toggleMute} className="text-white/60 hover:text-white transition-colors">
              {isMuted ? <IconVolumeOff className="h-5 w-5" /> : <IconVolume className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                const el = videoRef.current;
                if (el) {
                  el.volume = v;
                  el.muted = v === 0;
                  setIsMuted(v === 0);
                }
              }}
              className="w-0 group-hover/vol:w-20 transition-all duration-300 h-1 bg-white/30 appearance-none rounded-full accent-white cursor-pointer"
            />
          </div>
        </div>
        <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors">
          {isFullscreen ? <IconArrowsMinimize className="h-5 w-5" /> : <IconArrowsMaximize className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
