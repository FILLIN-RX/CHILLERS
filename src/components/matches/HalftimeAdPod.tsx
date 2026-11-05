"use client";

/**
 * Coupure pub HORS LIGNE du différé : la mi-temps d'un match est le seul
 * moment où l'écran publicitaire sur le direct a du sens. On diffuse un pod
 * de 2 à 3 créas (tag HilltopAds, une par une comme le midroll VOD), le
 * contenu est suspendu derrière l'overlay, reprend à la fin (ou à « Passer »,
 * actif après 10 s), et on ne rejoue jamais le pod dans le même match.
 *
 * Tout est local au player : le match reste un flux direct, l'IMA est en
 * mode overlay (z-40, noir) avec un <video> de rendu caché, comme en VOD.
 * Le direct joue en silence derrière l'overlay (on ne pause pas : en pause,
 * hls.js n'émet plus de fragments et le watchdog du player basculerait sur la
 * source suivante en pleine coupure pub).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@phosphor-icons/react";
import {
  VAST_TAG_URL,
  fetchSingleAdVast,
  loadImaSdk,
  logAdError,
  type ImaAdsLoader,
  type ImaAdsManager,
  type ImaDisplayContainer,
  type ImaEvent,
} from "@/lib/ima-ads";

const SKIP_DELAY_SECONDS = 10;
/** Nombre de créas dans la coupure : 2 à 3 (env NEXT_PUBLIC_MATCH_HALFTIME_ADS, défaut 3). */
const DEFAULT_POD_SIZE = Math.max(1, Math.min(3, Number(process.env.NEXT_PUBLIC_MATCH_HALFTIME_ADS) || 3));
const AD_START_TIMEOUT_MS = 6_000;

type BreakState = "idle" | "loading" | "playing";

export default function HalftimeAdPod({
  active,
  containerRef,
}: {
  /** true pendant la mi-temps (statusText/minute côté parent). */
  active: boolean;
  /** conteneur du player : le <video> direct y vit, muté pendant la coupure. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const managerRef = useRef<ImaAdsManager | null>(null);
  const displayContainerRef = useRef<ImaDisplayContainer | null>(null);
  const displayInitializedRef = useRef(false);
  const loaderRef = useRef<ImaAdsLoader | null>(null);
  const loadSlotRef = useRef<((slotIndex: number) => Promise<void>) | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skippedRef = useRef(false);
  const podStartedRef = useRef(false);
  const podMutedRef = useRef(false);
  const wasMutedBeforePodRef = useRef(false);
  const slotRef = useRef(0);
  const activeRef = useRef(active);
  const remainingRef = useRef(SKIP_DELAY_SECONDS);

  const [state, setState] = useState<BreakState>("idle");
  const [skipSeconds, setSkipSeconds] = useState(SKIP_DELAY_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [slot, setSlot] = useState(0);

  const contentVideo = useCallback(
    () => containerRef.current?.querySelector("video") as HTMLVideoElement | null,
    [containerRef],
  );

  const clearStartTimeout = useCallback(() => {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
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
    remainingRef.current = SKIP_DELAY_SECONDS;
    setSkipSeconds(SKIP_DELAY_SECONDS);
  }, [clearSkipCountdown]);

  const startSkipCountdown = useCallback(() => {
    clearSkipCountdown();
    remainingRef.current = SKIP_DELAY_SECONDS;
    setSkipSeconds(SKIP_DELAY_SECONDS);
    skipTimerRef.current = setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      setSkipSeconds(remainingRef.current);
      if (remainingRef.current === 0) clearSkipCountdown();
    }, 1000);
  }, [clearSkipCountdown]);

  /** Détruit le manager/loader/affichage, cache l'overlay, rend le son au direct. */
  const teardown = useCallback(
    () => {
      clearStartTimeout();
      clearSkipCountdown();

      const manager = managerRef.current;
      managerRef.current = null;
      try { manager?.destroy(); } catch { /* SDK teardown */ }
      const loader = loaderRef.current;
      loaderRef.current = null;
      try { loader?.destroy(); } catch { /* SDK teardown */ }
      const display = displayContainerRef.current;
      displayContainerRef.current = null;
      displayInitializedRef.current = false;
      try { display?.destroy(); } catch { /* SDK teardown */ }

      setState("idle");
      setRemainingSeconds(null);
      resetSkip();

      if (podMutedRef.current) {
        podMutedRef.current = false;
        const video = contentVideo();
        if (video) video.muted = wasMutedBeforePodRef.current;
      }
    },
    [clearSkipCountdown, clearStartTimeout, contentVideo, resetSkip],
  );

  const loadSlot = useCallback(
    async (slotIndex: number) => {
      if (!activeRef.current || skippedRef.current) return;
      const ima = typeof window !== "undefined" ? window.google?.ima : undefined;
      const content = contentVideo();
      const adVideo = adVideoRef.current;
      const adContainer = adContainerRef.current;
      if (!ima || !content || !adVideo || !adContainer) {
        teardown();
        return;
      }

      setState("loading");
      setSlot(slotIndex);

      const vastResponse = await fetchSingleAdVast(VAST_TAG_URL);
      if (!activeRef.current || skippedRef.current) return;
      if (!vastResponse) {
        teardown();
        return;
      }

      try {
        if (!displayContainerRef.current) {
          displayContainerRef.current = new ima.AdDisplayContainer(adContainer, adVideo);
        }
        const display = displayContainerRef.current;
        if (!displayInitializedRef.current) {
          display.initialize();
          displayInitializedRef.current = true;
        }

        const loader = new ima.AdsLoader(display);
        loaderRef.current = loader;

        loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (event: ImaEvent) => {
          logAdError(event);
          teardown();
        });

        loader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (event: ImaEvent) => {
          if (!loaderRef.current) return;
          try {
            const manager = event.getAdsManager(content, new ima.AdsRenderingSettings());
            managerRef.current = manager;
            manager.addEventListener(ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
              // On coupe le son du direct plutôt que de le pauser : hls.js
              // n'émettrait plus de segments, le watchdog verrait un flux mort
              // et basculerait sur la source d'après en pleine coupure pub.
              const video = contentVideo();
              if (video) {
                podMutedRef.current = true;
                wasMutedBeforePodRef.current = video.muted;
                video.muted = true;
              }
              setState("playing");
            });
            manager.addEventListener(ima.AdEvent.Type.STARTED, () => {
              clearStartTimeout();
              startSkipCountdown();
              setState("playing");
            });
            manager.addEventListener(ima.AdEvent.Type.AD_PROGRESS, () => {
              const remaining = manager.getRemainingTime();
              setRemainingSeconds(Number.isFinite(remaining) && remaining >= 0 ? Math.ceil(remaining) : null);
            });
            manager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
              const next = slotIndex + 1;
              if (next < DEFAULT_POD_SIZE && activeRef.current && !skippedRef.current) {
                // Un créa terminé → on enchaîne le suivant du pod.
                managerRef.current = null;
                loaderRef.current = null;
                try { manager.destroy(); } catch { /* SDK teardown */ }
                try { loader.destroy(); } catch { /* SDK teardown */ }
                slotRef.current = next;
                void loadSlotRef.current?.(next);
                return;
              }
              podStartedRef.current = true; // pod terminé pour ce match
              teardown();
            });
            manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, (errorEvent: ImaEvent) => {
              logAdError(errorEvent);
              teardown();
            });

            const bounds = adContainer.getBoundingClientRect();
            const width = Math.max(1, Math.round(bounds.width || content.clientWidth || 640));
            const height = Math.max(1, Math.round(bounds.height || content.clientHeight || 360));
            startTimeoutRef.current = setTimeout(() => {
              if (managerRef.current) teardown();
            }, AD_START_TIMEOUT_MS);
            manager.init(width, height, window.google?.ima?.ViewMode.NORMAL ?? "normal");
            manager.start();
          } catch {
            teardown();
          }
        });

        const request = new ima.AdsRequest();
        request.adsResponse = vastResponse;
        const bounds = adContainer.getBoundingClientRect();
        const width = Math.max(1, Math.round(bounds.width || content.clientWidth || 640));
        const height = Math.max(1, Math.round(bounds.height || content.clientHeight || 360));
        request.linearAdSlotWidth = width;
        request.linearAdSlotHeight = height;
        request.nonLinearAdSlotWidth = width;
        request.nonLinearAdSlotHeight = height;
        loader.requestAds(request);
      } catch {
        teardown();
      }
    },
    [clearStartTimeout, contentVideo, startSkipCountdown, teardown],
  );

  useEffect(() => {
    loadSlotRef.current = loadSlot;
  }, [loadSlot]);

  useEffect(() => {
    activeRef.current = active;

    if (!active) {
      // Mi-temps finie : coupure terminée, le direct reprend. On garde l'état
      // « déjà joué » — le pod ne repasse jamais dans ce match. Reporté d'un
      // tick pour ne pas setState en synchrone dans l'effet.
      const timer = setTimeout(() => teardown(), 0);
      return () => clearTimeout(timer);
    }

    // Déjà joué (ou skip) pour ce match : ne pas relancer à chaque re-render.
    if (podStartedRef.current) return undefined;

    podStartedRef.current = true;
    skippedRef.current = false;
    slotRef.current = 0;
    void (async () => {
      const ready = await loadImaSdk();
      if (!ready || !activeRef.current) {
        setState("idle");
        return;
      }
      await loadSlot(0);
    })();

    return undefined;
  }, [active, loadSlot, teardown]);

  // Démontage : on cache l'overlay et on rend le direct jouable.
  useEffect(() => {
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    if (remainingRef.current > 0) return;
    skippedRef.current = true;
    teardown();
  };

  if (!VAST_TAG_URL) return null;

  const visible = state !== "idle";

  return (
    <div
      ref={adContainerRef}
      aria-live="polite"
      className={`absolute inset-0 z-40 bg-black transition-opacity duration-200 ${
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* IMA insère sa propre <video> : celle-ci reste derrière, sans fond. */}
      <video ref={adVideoRef} className="absolute inset-0 -z-10 h-full w-full object-contain" playsInline />
      {state === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 text-white">
          <Spinner className="h-8 w-8 animate-spin" />
          <p className="text-sm text-white/80">Les publicités de la mi-temps démarrent…</p>
          <p className="text-xs text-white/55">Le direct reprendra juste après.</p>
        </div>
      )}
      {state === "playing" && (
        <>
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md bg-black/70 px-3 py-2 text-xs text-white/90">
            Publicité {slot + 1}/{DEFAULT_POD_SIZE}
            {remainingSeconds !== null ? ` · ${remainingSeconds} s` : ""}
          </div>
          <button
            type="button"
            onClick={skip}
            disabled={skipSeconds > 0}
            className={`absolute bottom-4 right-4 z-20 rounded-[5px] border px-3 py-2 text-xs font-semibold transition-colors ${
              skipSeconds === 0
                ? "cursor-pointer border-white/40 bg-black/70 text-white hover:bg-black/90"
                : "cursor-not-allowed border-white/15 bg-black/50 text-white/50"
            }`}
          >
            {skipSeconds === 0 ? "Passer les pubs" : `Passer dans ${skipSeconds} s`}
          </button>
        </>
      )}
    </div>
  );
}
