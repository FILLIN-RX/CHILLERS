"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type MidrollState = "idle" | "loading" | "playing";
type AdStatus = "idle" | "requesting" | "ready" | "unavailable";

interface ImaAdError {
  getErrorCode?: () => number;
  getMessage?: () => string;
}

interface ImaEvent {
  getAdsManager: (contentPlayback: HTMLVideoElement, settings?: unknown) => ImaAdsManager;
  getError?: () => ImaAdError;
}

interface ImaAdsManager {
  addEventListener: (event: string, listener: (event: ImaEvent) => void) => void;
  init: (width: number, height: number, viewMode: string) => void;
  start: () => void;
  destroy: () => void;
  getRemainingTime: () => number;
}

interface ImaAdsLoader {
  addEventListener: (event: string, listener: (event: ImaEvent) => void) => void;
  requestAds: (request: ImaAdsRequest) => void;
  contentComplete: () => void;
  destroy: () => void;
}

interface ImaAdsRequest {
  adTagUrl: string;
  adsResponse: string;
  linearAdSlotWidth: number;
  linearAdSlotHeight: number;
  nonLinearAdSlotWidth: number;
  nonLinearAdSlotHeight: number;
}

interface ImaDisplayContainer {
  initialize: () => void;
  destroy: () => void;
}

interface ImaSdk {
  AdDisplayContainer: new (container: Element, video: HTMLVideoElement) => ImaDisplayContainer;
  AdsLoader: new (container: ImaDisplayContainer) => ImaAdsLoader;
  AdsRequest: new () => ImaAdsRequest;
  AdsRenderingSettings: new () => unknown;
  ViewMode: { NORMAL: string };
  AdsManagerLoadedEvent: { Type: { ADS_MANAGER_LOADED: string } };
  AdErrorEvent: { Type: { AD_ERROR: string } };
  AdEvent: {
    Type: {
      CONTENT_PAUSE_REQUESTED: string;
      CONTENT_RESUME_REQUESTED: string;
      ALL_ADS_COMPLETED: string;
      AD_PROGRESS: string;
      STARTED: string;
    };
  };
}

declare global {
  interface Window {
    google?: { ima?: ImaSdk };
  }
}

const IMA_SCRIPT_ID = "google-ima-sdk";
const IMA_SCRIPT_URL = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
const IMA_LOAD_TIMEOUT_MS = 8_000;
const VAST_FETCH_TIMEOUT_MS = 8_000;
const AD_START_TIMEOUT_MS = 6_000;
const SKIP_DELAY_SECONDS = 10;
const MIN_CONTENT_DURATION_SECONDS = 120;
const PRELOAD_THRESHOLD = 0.4;
const BREAK_THRESHOLD = 0.5;
const VAST_TAG_URL = process.env.NEXT_PUBLIC_HILLTOP_VAST_TAG_URL?.trim()
  || "https://loyal-product.com/dBmhF.zKdpGsN/vkZHGlUU/veUmH9AuYZSUnl_kuP-T/cZ1aNPDKQd4vN/DmEEtdNHzOUA0_NDD/gu0dNtQJ";

function logAdError(event?: ImaEvent) {
  if (process.env.NODE_ENV === "production" || !event?.getError) return;
  const error = event.getError();
  console.warn("[midroll-vast]", error?.getErrorCode?.() ?? "unknown", error?.getMessage?.() ?? "");
}

/**
 * Récupère le VAST nous-mêmes et ne garde que la première création.
 * IMA 3.796 rejette l'intégralité de la réponse (erreur 1009) dès que le tag
 * HilltopAds en renvoie deux, alors que chaque création passe seule.
 */
async function fetchSingleAdVast(tagUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VAST_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(tagUrl, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) return null;
    const xml = await response.text();

    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "vast") return null;
    if (doc.getElementsByTagName("parsererror").length > 0) return null;

    const ads = Array.from(doc.getElementsByTagName("Ad"));
    if (ads.length === 0) return null;
    if (ads.length === 1) return xml;

    const single = doc.createElement("VAST");
    single.setAttribute("version", root.getAttribute("version") || "3.0");
    single.appendChild(ads[0]);
    return new XMLSerializer().serializeToString(single);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function loadImaSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.ima) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(success);
    };

    timeout = setTimeout(() => finish(Boolean(window.google?.ima)), IMA_LOAD_TIMEOUT_MS);

    let script = document.getElementById(IMA_SCRIPT_ID) as HTMLScriptElement | null;
    const onLoad = () => finish(Boolean(window.google?.ima));
    const onError = () => finish(false);

    if (!script) {
      script = document.createElement("script");
      script.id = IMA_SCRIPT_ID;
      script.src = IMA_SCRIPT_URL;
      script.async = true;
      script.onload = onLoad;
      script.onerror = onError;
      document.head.appendChild(script);
      return;
    }

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
  });
}

export function useMidrollVastAd(videoRef: RefObject<HTMLVideoElement | null>, mediaKey: string) {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const adsManagerRef = useRef<ImaAdsManager | null>(null);
  const adsLoaderRef = useRef<ImaAdsLoader | null>(null);
  const displayContainerRef = useRef<ImaDisplayContainer | null>(null);
  const managerInitializedRef = useRef(false);
  const breakHandledRef = useRef(false);
  const adPlayedRef = useRef(false);
  const preloadRequestedRef = useRef(false);
  const shouldStartRef = useRef(false);
  const displayInitializedRef = useRef(false);
  const hadUserGestureRef = useRef(false);
  const adStatusRef = useRef<AdStatus>("idle");
  const stateRef = useRef<MidrollState>("idle");
  const adStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipArmedRef = useRef(false);
  const skipCountRef = useRef(SKIP_DELAY_SECONDS);
  const [state, setState] = useState<MidrollState>("idle");
  const [sdkReady, setSdkReady] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [skipSeconds, setSkipSeconds] = useState(SKIP_DELAY_SECONDS);

  const changeState = useCallback((next: MidrollState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const clearStartTimeout = useCallback(() => {
    if (adStartTimeoutRef.current) {
      clearTimeout(adStartTimeoutRef.current);
      adStartTimeoutRef.current = null;
    }
  }, []);

  const clearSkipCountdown = useCallback(() => {
    if (skipTimerRef.current) {
      clearInterval(skipTimerRef.current);
      skipTimerRef.current = null;
    }
  }, []);

  const resetSkip = useCallback(() => {
    clearSkipCountdown();
    skipArmedRef.current = false;
    skipCountRef.current = SKIP_DELAY_SECONDS;
    setSkipSeconds(SKIP_DELAY_SECONDS);
  }, [clearSkipCountdown]);

  const startSkipCountdown = useCallback(() => {
    if (skipArmedRef.current) return;
    skipArmedRef.current = true;
    skipCountRef.current = SKIP_DELAY_SECONDS;
    setSkipSeconds(SKIP_DELAY_SECONDS);
    skipTimerRef.current = setInterval(() => {
      skipCountRef.current = Math.max(0, skipCountRef.current - 1);
      setSkipSeconds(skipCountRef.current);
      if (skipCountRef.current === 0) clearSkipCountdown();
    }, 1000);
  }, [clearSkipCountdown]);

  const teardown = useCallback((resumeContent: boolean) => {
    shouldStartRef.current = false;
    managerInitializedRef.current = false;
    clearStartTimeout();
    resetSkip();

    const manager = adsManagerRef.current;
    adsManagerRef.current = null;
    try { manager?.destroy(); } catch { /* Ignore SDK teardown errors. */ }

    const loader = adsLoaderRef.current;
    adsLoaderRef.current = null;
    try { loader?.destroy(); } catch { /* Ignore SDK teardown errors. */ }

    const displayContainer = displayContainerRef.current;
    displayContainerRef.current = null;
    displayInitializedRef.current = false;
    try { displayContainer?.destroy(); } catch { /* Ignore SDK teardown errors. */ }

    adStatusRef.current = "idle";
    setRemainingSeconds(null);
    changeState("idle");

    if (resumeContent) {
      // IMA peut remettre le contenu en pause pendant son destroy() :
      // on retente une fois après la fin de la créa.
      const resume = () => {
        const video = videoRef.current;
        if (video?.paused) video.play().catch(() => undefined);
      };
      resume();
      setTimeout(resume, 250);
    }
  }, [changeState, clearStartTimeout, resetSkip, videoRef]);

  const handleAdFailure = useCallback((event?: ImaEvent) => {
    logAdError(event);
    clearStartTimeout();
    const wasActive = stateRef.current !== "idle";
    teardown(wasActive);
    // Le tag n'a rien renvoyé : on ne retentera pas au point de rupture.
    adStatusRef.current = "unavailable";
  }, [clearStartTimeout, teardown]);

  const armStartTimeout = useCallback(() => {
    if (adStartTimeoutRef.current) return;
    adStartTimeoutRef.current = setTimeout(() => {
      adStartTimeoutRef.current = null;
      handleAdFailure();
    }, AD_START_TIMEOUT_MS);
  }, [handleAdFailure]);

  const ensureDisplayInitialized = useCallback(() => {
    const ima = window.google?.ima;
    const container = adContainerRef.current;
    const adVideo = adVideoRef.current;
    if (!ima || !container || !adVideo || displayInitializedRef.current) return;

    try {
      const displayContainer = displayContainerRef.current ?? new ima.AdDisplayContainer(container, adVideo);
      displayContainerRef.current = displayContainer;
      displayContainer.initialize();
      displayInitializedRef.current = true;
    } catch {
      // Initialisation refusée : la pub échouera sans bloquer le contenu.
    }
  }, []);

  const initializeFromUserGesture = useCallback(() => {
    hadUserGestureRef.current = true;
    ensureDisplayInitialized();
  }, [ensureDisplayInitialized]);

  const startLoadedAd = useCallback(() => {
    const manager = adsManagerRef.current;
    if (!manager || !shouldStartRef.current) return;

    armStartTimeout();

    try {
      if (!displayInitializedRef.current) ensureDisplayInitialized();
      if (!managerInitializedRef.current) {
        const container = adContainerRef.current;
        const bounds = container?.getBoundingClientRect();
        const width = Math.max(1, Math.round(bounds?.width || videoRef.current?.clientWidth || 640));
        const height = Math.max(1, Math.round(bounds?.height || videoRef.current?.clientHeight || 360));
        manager.init(width, height, window.google?.ima?.ViewMode.NORMAL ?? "normal");
        managerInitializedRef.current = true;
      }
      manager.start();
    } catch {
      handleAdFailure();
    }
  }, [armStartTimeout, ensureDisplayInitialized, handleAdFailure, videoRef]);

  const cancelMidrollForUserControl = useCallback((options?: { resumeContent?: boolean }) => {
    if (stateRef.current === "idle") return false;
    teardown(options?.resumeContent ?? true);
    return true;
  }, [teardown]);

  const skipAd = useCallback(() => {
    if (skipCountRef.current > 0) return false;
    return cancelMidrollForUserControl({ resumeContent: true });
  }, [cancelMidrollForUserControl]);

  const preloadAds = useCallback(async () => {
    if (preloadRequestedRef.current || !VAST_TAG_URL) return;
    preloadRequestedRef.current = true;
    adStatusRef.current = "requesting";

    const ready = sdkReady || await loadImaSdk();
    if (!ready) {
      adStatusRef.current = "unavailable";
      return;
    }

    const ima = window.google?.ima;
    const contentVideo = videoRef.current;
    const adVideo = adVideoRef.current;
    const adContainer = adContainerRef.current;
    if (!ima || !contentVideo || !adVideo || !adContainer) {
      adStatusRef.current = "unavailable";
      return;
    }

    const vastResponse = await fetchSingleAdVast(VAST_TAG_URL);
    // Épisode changé ou seek hors coupure pendant le téléchargement du tag.
    if (!preloadRequestedRef.current) return;
    if (!vastResponse) {
      adStatusRef.current = "unavailable";
      return;
    }

    try {
      const displayContainer = displayContainerRef.current ?? new ima.AdDisplayContainer(adContainer, adVideo);
      displayContainerRef.current = displayContainer;
      if (hadUserGestureRef.current && !displayInitializedRef.current) {
        try {
          displayContainer.initialize();
          displayInitializedRef.current = true;
        } catch {
          // L'initialisation sera retentée au point de rupture.
        }
      }

      const adsLoader = new ima.AdsLoader(displayContainer);
      adsLoaderRef.current = adsLoader;
      adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (event) => handleAdFailure(event));
      adsLoader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (event) => {
        // Réponse tardive après un timeout, un seek ou un changement d'épisode.
        if (!adsLoaderRef.current) return;
        try {
          const manager = event.getAdsManager(contentVideo, new ima.AdsRenderingSettings());
          adsManagerRef.current = manager;
          adStatusRef.current = "ready";
          manager.addEventListener(ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
            contentVideo.pause();
            changeState("playing");
          });
          manager.addEventListener(ima.AdEvent.Type.STARTED, () => {
            adPlayedRef.current = true;
            clearStartTimeout();
            startSkipCountdown();
            changeState("playing");
          });
          manager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => teardown(true));
          manager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => teardown(true));
          manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (errorEvent) => handleAdFailure(errorEvent));
          manager.addEventListener(ima.AdEvent.Type.AD_PROGRESS, () => {
            const remaining = manager.getRemainingTime();
            setRemainingSeconds(Number.isFinite(remaining) && remaining >= 0 ? Math.ceil(remaining) : null);
          });

          // Si le point de rupture est déjà atteint, on démarre tout de suite.
          if (shouldStartRef.current) startLoadedAd();
        } catch {
          handleAdFailure();
        }
      });

      const request = new ima.AdsRequest();
      request.adsResponse = vastResponse;
      const bounds = adContainer.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width || contentVideo.clientWidth || 640));
      const height = Math.max(1, Math.round(bounds.height || contentVideo.clientHeight || 360));
      request.linearAdSlotWidth = width;
      request.linearAdSlotHeight = height;
      request.nonLinearAdSlotWidth = width;
      request.nonLinearAdSlotHeight = height;
      adsLoader.requestAds(request);
    } catch {
      handleAdFailure();
    }
  }, [changeState, clearStartTimeout, handleAdFailure, sdkReady, startLoadedAd, startSkipCountdown, teardown, videoRef]);

  const onContentTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !VAST_TAG_URL || !sdkReady || breakHandledRef.current) return;
    if (video.seeking || video.paused) return;

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration < MIN_CONTENT_DURATION_SECONDS) return;

    if (!preloadRequestedRef.current && video.currentTime >= duration * PRELOAD_THRESHOLD) {
      void preloadAds();
    }

    if (video.currentTime < duration * BREAK_THRESHOLD) return;

    breakHandledRef.current = true;

    // Pas d'inventaire : on ne met jamais le contenu en attente pour rien.
    if (adStatusRef.current === "unavailable") return;

    shouldStartRef.current = true;
    video.pause();
    changeState("loading");
    armStartTimeout();
    startLoadedAd();
  }, [armStartTimeout, changeState, preloadAds, sdkReady, startLoadedAd, videoRef]);

  const onContentSeeked = useCallback((time: number) => {
    const video = videoRef.current;
    const duration = video?.duration ?? 0;
    const isPastBreak = Number.isFinite(duration) && duration > 0 && time >= duration * BREAK_THRESHOLD;

    if (isPastBreak) {
      if (stateRef.current !== "idle") teardown(true);
      else if (adsManagerRef.current || adsLoaderRef.current) teardown(false);
      shouldStartRef.current = false;
      breakHandledRef.current = true;
      clearStartTimeout();
      if (!adPlayedRef.current) {
        preloadRequestedRef.current = false;
        adStatusRef.current = "idle";
      }
      return;
    }

    // Retour en arrière avant la coupure : la pub peut encore se jouer si elle
    // n'a jamais démarré, sinon on ne la rejoue pas.
    if (!adPlayedRef.current) {
      breakHandledRef.current = false;
      if (sdkReady && adStatusRef.current === "unavailable") {
        adStatusRef.current = "idle";
        preloadRequestedRef.current = false;
      }
    }
  }, [clearStartTimeout, sdkReady, teardown, videoRef]);

  useEffect(() => {
    let active = true;
    void loadImaSdk().then((ready) => {
      if (active) setSdkReady(ready);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    breakHandledRef.current = false;
    adPlayedRef.current = false;
    preloadRequestedRef.current = false;
    shouldStartRef.current = false;
    managerInitializedRef.current = false;
    displayInitializedRef.current = false;
    adStatusRef.current = "idle";
    clearStartTimeout();
    resetSkip();
    if (stateRef.current !== "idle" || adsManagerRef.current || adsLoaderRef.current) teardown(false);
  }, [clearStartTimeout, mediaKey, resetSkip, teardown]);

  useEffect(() => () => {
    clearStartTimeout();
    clearSkipCountdown();
    const manager = adsManagerRef.current;
    const loader = adsLoaderRef.current;
    const displayContainer = displayContainerRef.current;
    adsManagerRef.current = null;
    adsLoaderRef.current = null;
    displayContainerRef.current = null;
    try { manager?.destroy(); } catch { /* Ignore SDK teardown errors. */ }
    try { loader?.destroy(); } catch { /* Ignore SDK teardown errors. */ }
    try { displayContainer?.destroy(); } catch { /* Ignore SDK teardown errors. */ }
  }, [clearSkipCountdown, clearStartTimeout]);

  return {
    adContainerRef,
    adVideoRef,
    midrollState: state,
    remainingSeconds,
    skipSeconds,
    canSkip: skipSeconds === 0,
    skipAd,
    onContentTimeUpdate,
    onContentSeeked,
    initializeFromUserGesture,
    cancelMidrollForUserControl,
    isConfigured: Boolean(VAST_TAG_URL),
  };
}
