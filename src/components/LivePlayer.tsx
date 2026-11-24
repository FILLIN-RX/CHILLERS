"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
// Type-only : hls.js (~530 Ko) est importé dynamiquement dans l'effet HLS.
import type Hls from "hls.js";
import { useLanguage } from "@/i18n/LanguageContext";
import type { LiveChannel } from "@/types/live";
import { PopupFirewall } from "@/lib/PopupFirewall";
import { enterFullscreen, exitFullscreen, isFullscreenActive } from "@/lib/fullscreen";
import { resolveOhaStream } from "@/services/oha";
import { liveChannelShareUrl } from "@/lib/live-channel-url";
import { X, Play, Pause, SpeakerSimpleHigh, SpeakerSimpleSlash, ArrowsOutSimple, ArrowsInSimple, Television, SoccerBall, PictureInPicture, ShareNetwork, Check } from "@phosphor-icons/react";

interface LivePlayerProps {
  channel: LiveChannel;
  allChannels?: LiveChannel[];
  onBack: () => void;
  onSelectChannel?: (ch: LiveChannel) => void;
  navigationItems?: LivePlayerNavigationItem[];
  navigationTitle?: string;
  navigationKind?: "channels" | "matches";
  onSelectNavigationItem?: (item: LivePlayerNavigationItem) => void;
  externalIframeUrl?: string;
  onExternalIframeLoad?: (iframe: HTMLIFrameElement) => void;
  onExternalIframeError?: () => void;
  /** Remplit entièrement l'écran (page player plein écran) au lieu d'un ratio 16:9 */
  fill?: boolean;
  // La page hôte affiche déjà sa propre barre du haut : ne pas empiler deux chromes
  hideTopBar?: boolean;
  /** Called after the active HLS source exhausted its recovery attempts. */
  onPlaybackError?: (reason: string) => void;
}

export interface LivePlayerNavigationItem {
  id: string;
  title: string;
  subtitle?: string;
  indicator?: string;
  score?: string;
  homeLogo?: string;
  awayLogo?: string;
  active?: boolean;
  href?: string;
  channel?: LiveChannel;
}

const PROXY_BASE = "/api/live/proxy";

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  const hours = Math.floor(minutes / 60);
  return hours > 0
    ? `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function buildProxyUrl(url: string): string {
  if (!url) return "";
  if (url.includes("/api/live/proxy")) return url;
  // Les relays HLS du backend sont déjà same-origin/CORS : les ré-envelopper
  // ajoute un hop et double la latence de chaque playlist et segment.
  if (url.startsWith("/api/") || url.includes("/api/sports/") || url.includes("/api/liveball/")) {
    return url;
  }
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

function MatchTeamMark({ logo, name }: { logo?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/[\s-]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/35 text-[9px] font-bold text-white/75">
      {logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} loading="lazy" className="h-7 w-7 object-contain" onError={() => setFailed(true)} />
      ) : initials}
    </span>
  );
}

export default function LivePlayer({
  channel,
  allChannels = [],
  onBack,
  onSelectChannel,
  navigationItems,
  navigationTitle,
  navigationKind = "channels",
  onSelectNavigationItem,
  externalIframeUrl,
  onExternalIframeLoad,
  onExternalIframeError,
  fill = false,
  hideTopBar = false,
  onPlaybackError,
}: LivePlayerProps) {
  const { translate: _ } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferingIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [liveProgress, setLiveProgress] = useState(100);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  // Muet au démarrage : un <video> non muet sans geste préalable voit son play()
  // refusé, et le refus n'émet aucun événement — sans ceci, écran noir.
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showChannelDrawer, setShowChannelDrawer] = useState(false);
  const onPlaybackErrorRef = useRef(onPlaybackError);
  /** Volume lu à chaud par l'effet HLS : le state `isMuted` n'est pas une dépendance. */
  const mutedRef = useRef(true);
  const userMuteChoiceRef = useRef(false);
  /** Pause voulue par l'utilisateur : ne doit pas être lue comme un flux mort. */
  const userPausedRef = useRef(false);
  /** Une première image a déjà été affichée : les rebuffers ne doivent plus masquer le flux. */
  const hasPlayedRef = useRef(false);
  /** URL du flux précédent, pour ne pas réinitialiser l'état sur un simple repli proxy. */
  const lastStreamUrlRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [proxyMode, setProxyMode] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [resolvedOha, setResolvedOha] = useState<{ channelId: string; url: string } | null>(null);
  const [streamRevision, setStreamRevision] = useState(0);
  const ohaResolveAttemptsRef = useRef(0);

  const streamUrl = (resolvedOha?.channelId === channel._id ? resolvedOha.url : channel.streamUrl) || "";

  const isHls = channel.type === "hls" && !externalIframeUrl;

  const clearBufferingIndicatorTimer = useCallback(() => {
    if (bufferingIndicatorTimerRef.current) {
      clearTimeout(bufferingIndicatorTimerRef.current);
      bufferingIndicatorTimerRef.current = null;
    }
  }, []);

  const delayBufferingIndicator = useCallback(() => {
    if (bufferingIndicatorTimerRef.current) return;
    bufferingIndicatorTimerRef.current = setTimeout(() => {
      bufferingIndicatorTimerRef.current = null;
      setIsBuffering(true);
    }, 600);
  }, []);

  useEffect(() => clearBufferingIndicatorTimer, [clearBufferingIndicatorTimer]);
  const drawerItems: LivePlayerNavigationItem[] = navigationItems ?? allChannels.map((item) => ({
    id: item.slug,
    title: item.name,
    subtitle: item.categories?.[0] || "Direct",
    active: item.slug === channel.slug,
    channel: item,
  }));
  const drawerTitle = navigationTitle ?? (navigationKind === "matches" ? "Autres matchs" : "Toutes les chaînes");

  useEffect(() => {
    onPlaybackErrorRef.current = onPlaybackError;
  }, [onPlaybackError]);

  const resolveOhaFallback = useCallback((force = false) => {
    if (channel.source !== "oha" || !channel.ohaId) return false;
    const maxAttempts = force ? 3 : 1;
    if (ohaResolveAttemptsRef.current >= maxAttempts) return false;
    ohaResolveAttemptsRef.current += 1;
    setIsLoading(true);
    setError(null);
    void resolveOhaStream(channel.ohaId, channel.ohaAltIds ?? [], { force })
      .then((url) => {
        setResolvedOha({ channelId: channel._id, url });
        setStreamRevision((value) => value + 1);
        setProxyMode(false);
      })
      .catch(() => {
        setIsLoading(false);
        setError("stream");
        onPlaybackErrorRef.current?.("Le flux OHA n’a pas pu être résolu");
      });
    return true;
  }, [channel._id, channel.ohaAltIds, channel.ohaId, channel.source]);

  const retryPlayback = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setProxyMode(false);
    ohaResolveAttemptsRef.current = 0;
    if (resolveOhaFallback(true)) return;
    setStreamRevision((value) => value + 1);
  }, [resolveOhaFallback]);

  const iframeSrc = externalIframeUrl || (
    channel.type === "youtube" && channel.ytVideoId
      ? `https://www.youtube-nocookie.com/embed/${channel.ytVideoId}?autoplay=1&muted=0&rel=0&modestbranding=1&playsinline=1`
      : channel.type === "dailymotion" && channel.ytVideoId
        ? `https://www.dailymotion.com/embed/video/${channel.ytVideoId}?autoplay=1&muted=0`
        : null
  );

  // Détection dynamique de l'état LIVE (en direct vs différé/pause)
  const updateLiveState = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setPlaybackSeconds(el.currentTime || 0);

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
    if (!streamUrl) {
      if (resolveOhaFallback()) return;
      setError("no-stream");
      return;
    }
    if (!el) return;

    if (lastStreamUrlRef.current !== streamUrl) {
      lastStreamUrlRef.current = streamUrl;
      hasPlayedRef.current = false;
    }

    setError(null);
    setIsLoading(!hasPlayedRef.current);
    setIsBuffering(false);
    setIsLive(true);
    setLiveProgress(100);

    const lowLatency = true;
    const config: any = {
      enableWorker: true,
      lowLatencyMode: lowLatency,
      maxBufferLength: lowLatency ? 20 : 30,
      maxMaxBufferLength: lowLatency ? 40 : 60,
      backBufferLength: lowLatency ? 10 : 2,
      maxLoadingDelay: 2,
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.1,
      nudgeMaxRetry: 5,
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      startLevel: -1,
      abrEwmaDefaultEstimate: 1_200_000,
      // Deux segments de marge : le direct reste très proche du live, mais un
      // hoquet réseau ne suffit plus à vider le buffer et à figer l'image.
      liveSyncDurationCount: lowLatency ? 2 : 3,
      liveMaxLatencyDurationCount: lowLatency ? 5 : 6,
      maxLiveSyncPlaybackRate: 1.08,
    };
    const isBackendRelay =
      streamUrl.includes("/api/sports/") || streamUrl.includes("/api/liveball/");
    const isCorsRestricted = Boolean(
      (channel as any).proxy ||
      streamUrl.includes('amagi.tv') ||
      streamUrl.includes('wurl.com') ||
      streamUrl.includes('edgesuite.net')
    );

    const effectiveUrl = (!isBackendRelay && (proxyMode || isCorsRestricted))
      ? buildProxyUrl(streamUrl)
      : streamUrl;

    const startPlayback = async () => {
      el.muted = mutedRef.current;
      try {
        await el.play();
      } catch {
        // Second essai muet : c'est le seul que les politiques d'autoplay
        // tolèrent sans geste. S'il échoue aussi, on rend la main au CTA.
        el.muted = true;
        mutedRef.current = true;
        try {
          await el.play();
        } catch {
          // L'autoplay est refusé : on doit sortir du chargement initial pour
          // laisser apparaître le bouton Play, sinon l'écran reste bloqué.
          setIsLoading(false);
          setIsPlaying(false);
          setIsLive(false);
          return;
        }
      }
      setIsMuted(el.muted);
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
      if (resolveOhaFallback(true)) return;
      failureReported = true;
      onPlaybackErrorRef.current?.(reason);
    };
    let playbackTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePlaybackWatchdog = () => {
      if (playbackTimer) clearTimeout(playbackTimer);
      playbackTimer = setTimeout(() => {
        setError("stream");
        reportFailure("Aucun nouveau segment vidéo reçu depuis trop longtemps");
      }, hasPlayedRef.current ? 30_000 : 45_000);
    };
    schedulePlaybackWatchdog();

    // Le watchdog ci-dessus est remis à zéro par chaque fragment : un élément
    // figé pendant que le buffer se remplit lui échappe complètement. Cette
    // sonde lit la progression de lecture, pas le réseau.
    let probeLastTime = el.currentTime;
    let probeStalledMs = 0;
    const progressProbe = setInterval(() => {
      if (!hasPlayedRef.current || el.paused || userPausedRef.current) {
        probeStalledMs = 0;
        probeLastTime = el.currentTime;
        return;
      }
      if (Math.abs(el.currentTime - probeLastTime) < 0.05) {
        probeStalledMs += 2000;
        if (probeStalledMs >= 30_000) {
          probeStalledMs = 0;
          setIsPlaying(false);
          setIsLive(false);
          reportFailure("Aucune progression de lecture depuis 30 secondes");
        }
      } else {
        probeStalledMs = 0;
        probeLastTime = el.currentTime;
      }
    }, 2000);

    // Import à la demande de hls.js (~530 Ko) : jamais dans le bundle initial.
    void (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (!isBackendRelay && (proxyMode || isCorsRestricted) && Hls.DefaultConfig?.loader) {
        const ProxiedHlsLoader = buildProxiedLoader(Hls);
        if (ProxiedHlsLoader) {
          config.loader = ProxiedHlsLoader;
          config.pLoader = ProxiedHlsLoader;
        }
      }

      let relayRetryUsed = false;
      if (Hls.isSupported()) {
        hls = new Hls(config);
        hls.loadSource(effectiveUrl);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
        hls.on(Hls.Events.FRAG_LOADED, () => {
          schedulePlaybackWatchdog();
          clearBufferingIndicatorTimer();
          hasPlayedRef.current = true;
          ohaResolveAttemptsRef.current = 0;
          setError(null);
          setIsLoading(false);
          setIsBuffering(false);
          updateLiveState();
        });
        hls.on(Hls.Events.FRAG_BUFFERED, schedulePlaybackWatchdog);
        hls.on(Hls.Events.LEVEL_LOADED, schedulePlaybackWatchdog);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data?.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (isBackendRelay) {
              if (!relayRetryUsed) {
                relayRetryUsed = true;
                hls?.startLoad();
                return;
              }
              setError("stream");
              reportFailure("Le flux HLS ne répond plus");
              return;
            }
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
          if (!isBackendRelay && !proxyMode) {
            setProxyMode(true);
          } else {
            setError("stream");
            reportFailure("Le flux HLS ne répond plus");
          }
        });
      } else {
        setError("unsupported");
        if (playbackTimer) clearTimeout(playbackTimer);
        clearInterval(progressProbe);
        reportFailure("HLS non supporté par ce navigateur");
      }
    })();

    return () => {
      cancelled = true;
      if (playbackTimer) clearTimeout(playbackTimer);
      clearInterval(progressProbe);
      el.removeEventListener("timeupdate", schedulePlaybackWatchdog);
      if (hls) hls.destroy();
    };
  }, [isHls, channel._id, channel.streamUrl, channel.source, channel.ohaId, channel.ohaAltIds, streamUrl, streamRevision, resolveOhaFallback, proxyMode, updateLiveState, externalIframeUrl, clearBufferingIndicatorTimer]);

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
      userPausedRef.current = false;
      el.play()
        .then(() => {
          setIsPlaying(true);
          updateLiveState();
        })
        .catch(() => {
          // Le tap qui amène ici EST le geste préalable qu'exige la politique
          // d'autoplay : le repli muet ne devrait jamais servir, mais certains
          // navigateurs le réclament quand même.
          el.muted = true;
          mutedRef.current = true;
          setIsMuted(true);
          return el.play().catch(() => {
            setIsPlaying(false);
            setIsLive(false);
          });
        });
    } else {
      userPausedRef.current = true;
      el.pause();
      setIsPlaying(false);
      setIsLive(false);
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    mutedRef.current = el.muted;
    userMuteChoiceRef.current = true;
    setIsMuted(el.muted);
  };

  // Le direct démarre muet pour passer l'autoplay ; le premier geste réel rend
  // le son, sauf si l'utilisateur a lui-même coupé le volume.
  useEffect(() => {
    if (!isMuted || iframeSrc) return;
    const unmute = () => {
      if (userMuteChoiceRef.current) return;
      const el = videoRef.current;
      if (!el) return;
      el.muted = false;
      mutedRef.current = false;
      setIsMuted(false);
    };
    window.addEventListener("pointerdown", unmute, { capture: true });
    window.addEventListener("keydown", unmute, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unmute, { capture: true });
      window.removeEventListener("keydown", unmute, { capture: true });
    };
  }, [iframeSrc, isMuted]);

  const handleShare = async () => {
    const title = channel.name || "CHILLERS";
    const url = liveChannelShareUrl(channel);
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
      {/* ── Main Video Layer ────────────────────────────────────── */}
      {iframeSrc ? (
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          className="absolute inset-0 w-full h-full border-none bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture; gyroscope; accelerometer; clipboard-write"
          referrerPolicy="no-referrer"
          title={channel.name}
          onLoad={(event) => {
            setIsLoading(false);
            onExternalIframeLoad?.(event.currentTarget);
          }}
          onError={onExternalIframeError}
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer"
          playsInline
          preload="auto"
          onClick={togglePlay}
          onWaiting={() => {
            if (hasPlayedRef.current) {
              delayBufferingIndicator();
            } else {
              setIsLoading(true);
            }
          }}
          onPlaying={() => {
            hasPlayedRef.current = true;
            ohaResolveAttemptsRef.current = 0;
            setError(null);
            setIsLoading(false);
            clearBufferingIndicatorTimer();
            setIsBuffering(false);
            setIsPlaying(true);
            updateLiveState();
          }}
          onCanPlay={() => {
            setIsLoading(false);
            if (hasPlayedRef.current) {
              clearBufferingIndicatorTimer();
              setIsBuffering(false);
            }
          }}
          onTimeUpdate={updateLiveState}
          onPause={() => {
            setIsPlaying(false);
            setIsLive(false);
          }}
          onSeeking={updateLiveState}
          onSeeked={updateLiveState}
        />
      )}

      {/* ── Reprise : le geste manque, pas le flux ──────────────── */}
      {/* Sous les barres (z-30) pour laisser le volume atteignable, mais jamais
          masquée par hideTopBar : sans elle, un autoplay refusé ne montre
          qu'un rectangle noir sans explication ni recours. */}
      {!iframeSrc && !isLoading && !isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Lancer le direct"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/55 text-white"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
            <Play className="h-7 w-7 translate-x-px" weight="fill" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/75">Lecture</span>
        </button>
      )}

      {/* ── Central Circular Spinner (Canal+ Style) ─────────────── */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-[3.5px] border-white/10 border-t-red-600 border-r-red-500 animate-spin" />
        </div>
      )}

      {/* ── Rebuffering : ne jamais recouvrir l'image déjà affichée ── */}
      {isBuffering && !isLoading && !error && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/75 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 rounded-full border border-white/25 border-t-white/80 animate-spin" />
            Reprise de la lecture…
          </div>
        </div>
      )}

      {/* ── Error Screen ────────────────────────────────────────── */}
      {/* Masqué sur les couches match (hideTopBar) : aucun overlay ne
          recouvre plus le flux, la bascule de source est silencieuse. */}
      {error && !hideTopBar && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
            <Television className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white">Flux momentanément indisponible</h3>
          <p className="text-sm text-zinc-400 max-w-md">
            La chaîne {channel.name} est en cours d&apos;actualisation ou le signal source est interrompu.
          </p>
          <button
            type="button"
            onClick={retryPlayback}
            className="rounded-full bg-red-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-red-500"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── TOP BAR OVERLAY (Canal+ Style) ──────────────────────── */}
      <div
        className={`absolute top-0 inset-x-0 z-30 pt-[calc(0.8rem_+_env(safe-area-inset-top,0px))] pb-5 pl-[calc(1rem_+_env(safe-area-inset-left,0px))] pr-[calc(1rem_+_env(safe-area-inset-right,0px))] bg-gradient-to-b from-black/65 to-transparent transition-opacity duration-300 ${
          hideTopBar ? "hidden" : showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="relative flex min-h-12 items-start justify-center gap-4">
          <div className="absolute left-0 top-0">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fermer le lecteur"
              title="Fermer le lecteur"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-w-0 max-w-[72vw] text-center sm:max-w-3xl">
            <h1 className="truncate text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
              {channel.name}
            </h1>
            <p className="mt-0.5 truncate text-[11px] font-medium text-white/75 sm:text-xs">
              {channel.epgNow?.title || (isLive ? "Télévision en direct" : "Différé")}
            </p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR OVERLAY (Canal+ Style) ───────────────────── */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 pt-8 pb-[calc(0.65rem_+_env(safe-area-inset-bottom,0px))] sm:pb-3 pl-[calc(0.75rem_+_env(safe-area-inset-left,0px))] pr-[calc(0.75rem_+_env(safe-area-inset-right,0px))] bg-gradient-to-t from-black/85 via-black/35 to-transparent transition-opacity duration-300 space-y-2 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Barre de timeline en direct (interactive) */}
        {!externalIframeUrl && (
          <div
            onClick={handleTimelineClick}
            className="relative h-[3px] w-full cursor-pointer overflow-hidden bg-white/30 transition-[height] hover:h-1"
          >
            <div
              style={{ width: `${liveProgress}%` }}
              className={`absolute top-0 bottom-0 left-0 transition-all duration-150 ${isLive ? "bg-[#f02d5e]" : "bg-white/80"}`}
            />
          </div>
        )}

        {/* Ligne des contrôles */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Gauche : Volume, Lecture/Pause, LIVE */}
          <div className={`flex items-center gap-3 sm:gap-5 ${externalIframeUrl ? "hidden" : ""}`}>
            <button
              onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={isMuted ? "Activer le son" : "Couper le son"}
            >
              {isMuted ? (
                <SpeakerSimpleSlash className="h-5 w-5" />
              ) : (
                <SpeakerSimpleHigh className="h-5 w-5" />
              )}
            </button>

            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
              aria-label={isPlaying ? "Pause" : "Lecture"}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-white" />
              )}
            </button>

            <button
              onClick={jumpToLive}
              title={isLive ? "Vous êtes en direct" : "Cliquer pour revenir au direct"}
              className={`ml-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                isLive
                  ? "text-[#f02d5e]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                    isLive ? "bg-[#f02d5e] animate-pulse" : "bg-zinc-500"
                }`}
              />
              LIVE
            </button>
            <span className="ml-1 whitespace-nowrap text-[11px] tabular-nums text-white/65">
              {formatPlaybackTime(playbackSeconds)}
            </span>
          </div>

          {/* Droite : Chaînes, Plein écran */}
          <div className="flex items-center gap-1 sm:gap-3">
            {drawerItems.length > 0 && (
              <button
                onClick={() => setShowChannelDrawer(!showChannelDrawer)}
                className="flex h-9 items-center gap-2 rounded-full px-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:px-2.5"
                aria-label={drawerTitle}
                title={drawerTitle}
              >
                {navigationKind === "matches" ? <SoccerBall className="h-4 w-4" /> : <Television className="h-4 w-4" />}
                <span className="hidden text-[11px] font-medium sm:inline">{navigationKind === "matches" ? "Matchs" : "Chaînes"}</span>
              </button>
            )}

            <button
              onClick={togglePictureInPicture}
              className={`hidden h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:flex ${externalIframeUrl ? "!hidden" : ""}`}
              aria-label="Mini-lecteur"
              title="Mini-lecteur"
            >
              <PictureInPicture className="h-5 w-5" />
            </button>
            {navigationKind !== "matches" && !externalIframeUrl && (
              <button
                onClick={handleShare}
                className="hidden h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white sm:flex"
                aria-label="Partager"
                title={shareCopied ? "Lien copié !" : "Partager"}
              >
                {shareCopied ? <Check className="h-5 w-5 text-[#f02d5e]" /> : <ShareNetwork className="h-5 w-5" />}
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
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
              {navigationKind === "matches" ? <SoccerBall className="h-4 w-4 text-red-400" /> : <Television className="h-4 w-4 text-red-400" />}
              {drawerTitle}
            </h3>
            <button
              onClick={() => setShowChannelDrawer(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {drawerItems.map((item) => {
              const isCurrent = item.active ?? item.channel?.slug === channel.slug;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    if (item.href) {
                      window.location.assign(item.href);
                    } else if (item.channel) {
                      onSelectChannel?.(item.channel);
                    } else {
                      onSelectNavigationItem?.(item);
                    }
                    setShowChannelDrawer(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${
                    isCurrent
                      ? "liquid-glass-surface border-0 text-white shadow-none"
                      : "bg-white/[0.045] text-zinc-300 hover:bg-white/[0.09]"
                  }`}
                  style={isCurrent ? {
                    backgroundColor: "rgba(225, 29, 72, 0.27)",
                    border: 0,
                    boxShadow: "0 8px 20px -16px rgba(225, 29, 72, 0.9)",
                  } : undefined}
                  aria-pressed={isCurrent}
                >
                  {item.channel ? (
                    <ChannelLogoBadge
                      logo={item.channel.logo}
                      name={item.channel.name}
                      className="h-7 w-10"
                      fallbackClassName="w-10 h-7"
                    />
                  ) : navigationKind === "matches" ? (
                    <span className="flex w-[76px] shrink-0 items-center justify-between">
                      <MatchTeamMark logo={item.homeLogo} name={item.title.split(" vs ")[0] || item.title} />
                      <span className="px-0.5 text-[8px] font-bold text-white/35">VS</span>
                      <MatchTeamMark logo={item.awayLogo} name={item.title.split(" vs ")[1] || item.title} />
                    </span>
                  ) : (
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.indicator?.toLowerCase().includes("direct") ? "bg-red-500/15 text-red-300" : "bg-white/10 text-white/65"}`}>
                      <SoccerBall className="h-4 w-4" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[11px] font-bold leading-tight text-white">{item.title}</h4>
                    <span className="mt-1 block truncate text-[9px] text-white/55">{item.subtitle || (navigationKind === "matches" ? "Rencontre" : "Direct")}</span>
                  </div>

                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    {item.score && <span className="text-[11px] font-black tabular-nums text-white">{item.score}</span>}
                    {item.indicator && (
                      <span className={`text-[8px] font-bold uppercase tracking-wide ${item.indicator.toLowerCase().includes("direct") ? "text-red-300" : "text-white/45"}`}>
                        {item.indicator}
                      </span>
                    )}
                    {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-red-300 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
