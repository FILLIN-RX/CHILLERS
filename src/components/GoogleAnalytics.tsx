"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const MEASUREMENT_ID = "G-07EF63R64Y";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __chillersAnalyticsLoaded?: boolean;
  }
}

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.__chillersAnalyticsLoaded) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("js", new Date());
    // Route page views are emitted below by the SPA tracker to avoid relying
    // on GA's history-change setting (and to prevent duplicate page views).
    window.gtag("config", MEASUREMENT_ID, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    script.dataset.chillersAnalytics = "true";
    document.head.appendChild(script);
    window.__chillersAnalyticsLoaded = true;
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const url = new URL(window.location.href);
    const campaign = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
      .map((key) => {
        const value = url.searchParams.get(key);
        return value ? `${key}=${encodeURIComponent(value)}` : "";
      })
      .filter(Boolean)
      .join("&");
    const pagePath = `${pathname}${campaign ? `?${campaign}` : ""}`;
    window.gtag?.("event", "page_view", {
      page_title: document.title,
      page_location: `${window.location.origin}${pagePath}`,
      page_path: pagePath,
    });
  }, [pathname]);

  return null;
}
