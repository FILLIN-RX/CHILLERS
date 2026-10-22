"use client";

import { useEffect } from "react";

const MEASUREMENT_ID = "G-07EF63R64Y";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __chillersAnalyticsLoaded?: boolean;
  }
}

export default function GoogleAnalytics() {
  useEffect(() => {
    if (window.__chillersAnalyticsLoaded) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID);

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.dataset.chillersAnalytics = "true";
    document.head.appendChild(script);
    window.__chillersAnalyticsLoaded = true;
  }, []);

  return null;
}
