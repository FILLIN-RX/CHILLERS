"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const MEASUREMENT_ID = "G-07EF63R64Y";
const GTM_ID = "GTM-WSB9KSPX";

// Lighthouse mesure le TBT jusqu'à ~9 s. Les deux bundles GTM (~550 Ko) et
// gtag.js (~545 Ko) représentent >1 Mo de JS à parser/exécuter : on ne les
// charge qu'après une interaction ou bien après cette fenêtre.
const ANALYTICS_DELAY_MS = 12_000;

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

    // Stub sans réseau : les page_view émises avant le chargement sont
    // simplement mises en file dans dataLayer.
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("js", new Date());
    window.gtag("config", MEASUREMENT_ID, { send_page_view: false });

    let timer: ReturnType<typeof setTimeout> | undefined;

    const loadAnalytics = () => {
      if (window.__chillersAnalyticsLoaded) return;
      window.__chillersAnalyticsLoaded = true;

      window.removeEventListener("pointerdown", loadAnalytics);
      window.removeEventListener("keydown", loadAnalytics);

      window.dataLayer?.push({ "gtm.start": Date.now(), event: "gtm.js" });

      const gtm = document.createElement("script");
      gtm.async = true;
      gtm.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
      document.head.appendChild(gtm);

      const ga = document.createElement("script");
      ga.async = true;
      ga.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      ga.dataset.chillersAnalytics = "true";
      document.head.appendChild(ga);
    };

    window.addEventListener("pointerdown", loadAnalytics, { once: true, passive: true });
    window.addEventListener("keydown", loadAnalytics, { once: true });
    timer = setTimeout(loadAnalytics, ANALYTICS_DELAY_MS);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("pointerdown", loadAnalytics);
      window.removeEventListener("keydown", loadAnalytics);
    };
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
