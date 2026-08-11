"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useLanguage } from "@/i18n/LanguageContext";
import type { LiveChannel } from "@/types/live";
import { IconX, IconRefresh } from "@tabler/icons-react";

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

  const [isLoading, setIsLoading] = useState(true);
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
        /* gesture-gated */
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

  /* ───────── Keyboard shortcuts (live) ───────── */

  useEffect(() => {
    if (iframeSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.tagName === "IFRAME") return;
      const video = videoRef.current;
      if (!video) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      } else if (e.code === "KeyM") {
        video.muted = !video.muted;
      } else if (e.code === "KeyF") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else containerRef.current?.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [iframeSrc]);

  const errorMessage =
    error === "no-stream"
      ? _("live.noStream")
      : error === "unsupported"
        ? _("live.unsupported")
        : _("live.streamUnavailable");

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black overflow-hidden select-none shadow-2xl ring-1 ring-white/5"
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
          controls
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onCanPlay={() => setIsLoading(false)}
        />
      )}

      {/* Loading spinner */}
      {isLoading && !error && !iframeSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 pointer-events-none">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-[3px] border-white/10 border-t-[#D70466] border-r-[#7C3AED] animate-spin" />
          </div>
        </div>
      )}

      {/* Error + retry */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="font-semibold text-lg text-white">{errorMessage}</p>
          <p className="text-sm text-white/50 max-w-md">
            {error === "stream" ? _("live.streamUnavailableDesc") : ""}
          </p>
          <button
            onClick={retry}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur"
          >
            <IconRefresh className="h-4 w-4" />
            {_("live.retry")}
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/85 to-transparent h-28" />
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm sm:text-base font-black tracking-widest uppercase bg-gradient-to-r from-[#D70466] to-[#7C3AED] bg-clip-text text-transparent shrink-0">
            Chillers
          </span>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-red-600 text-white px-2 py-1 rounded-md flex items-center gap-1.5 shrink-0 shadow-lg shadow-red-600/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            {_("live.liveLabel")}
          </span>
          <span className="text-sm sm:text-base md:text-lg font-black tracking-wide text-white truncate">
            {channel.name}
          </span>
        </div>
        <button
          onClick={onBack}
          className="p-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/10 shrink-0"
          aria-label={_("live.backToLive")}
          title="Fermer"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
