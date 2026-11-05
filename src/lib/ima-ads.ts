"use client";

/**
 * Socles IMA / VAST partagés entre le midroll VOD (useMidrollVastAd) et la
 * coupure pub de la mi-temps des matchs (HalftimeAdPod) : chargement de la
 * SDK Google IMA, récupération du tag HilltopAds (une seule créa gardée).
 */

export interface ImaAdError {
  getErrorCode?: () => number;
  getMessage?: () => string;
}

export interface ImaEvent {
  getAdsManager: (contentPlayback: HTMLVideoElement, settings?: unknown) => ImaAdsManager;
  getError?: () => ImaAdError;
}

export interface ImaAdsManager {
  addEventListener: (event: string, listener: (event: ImaEvent) => void) => void;
  init: (width: number, height: number, viewMode: string) => void;
  start: () => void;
  destroy: () => void;
  getRemainingTime: () => number;
}

export interface ImaAdsLoader {
  addEventListener: (event: string, listener: (event: ImaEvent) => void) => void;
  requestAds: (request: ImaAdsRequest) => void;
  contentComplete: () => void;
  destroy: () => void;
}

export interface ImaAdsRequest {
  adTagUrl: string;
  adsResponse: string;
  linearAdSlotWidth: number;
  linearAdSlotHeight: number;
  nonLinearAdSlotWidth: number;
  nonLinearAdSlotHeight: number;
}

export interface ImaDisplayContainer {
  initialize: () => void;
  destroy: () => void;
}

export interface ImaSdk {
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

export const IMA_SCRIPT_ID = "google-ima-sdk";
const IMA_SCRIPT_URL = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
const IMA_LOAD_TIMEOUT_MS = 8_000;
const VAST_FETCH_TIMEOUT_MS = 8_000;

export const VAST_TAG_URL = process.env.NEXT_PUBLIC_HILLTOP_VAST_TAG_URL?.trim()
  || "https://loyal-product.com/dBmhF.zKdpGsN/vkZHGlUU/veUmH9AuYZSUnl_kuP-T/cZ1aNPDKQd4vN/DmEEtdNHzOUA0_NDD/gu0dNtQJ";

export function logAdError(event?: ImaEvent) {
  if (process.env.NODE_ENV === "production" || !event?.getError) return;
  const error = event.getError();
  console.warn("[ads-ima]", error?.getErrorCode?.() ?? "unknown", error?.getMessage?.() ?? "");
}

/**
 * Récupère le VAST nous-mêmes et ne garde que la première création.
 * IMA 3.796 rejette l'intégralité de la réponse (erreur 1009) dès que le tag
 * HilltopAds en renvoie deux, alors que chaque création passe seule.
 */
export async function fetchSingleAdVast(tagUrl: string): Promise<string | null> {
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


export function loadImaSdk(): Promise<boolean> {
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

