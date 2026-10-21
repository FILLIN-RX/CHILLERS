"use client";

import { useCallback, useEffect, useState } from "react";

const CONSENT_KEY = "chillers-analytics-consent-v1";
const MEASUREMENT_ID = "G-07EF63R64Y";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __chillersAnalyticsLoaded?: boolean;
  }
}

type Choice = "accepted" | "refused" | null;

function loadAnalytics() {
  if (typeof window === "undefined") return;

  if (!window.__chillersAnalyticsLoaded) {
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
  } else {
    window.gtag?.("consent", "update", { analytics_storage: "granted" });
  }
}

export default function AnalyticsConsent() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const savedChoice = window.localStorage.getItem(CONSENT_KEY);
    if (savedChoice === "accepted" || savedChoice === "refused") {
      if (savedChoice === "accepted") loadAnalytics();
    } else {
      setShowPrompt(true);
    }

    const reopenPrompt = () => setShowPrompt(true);
    window.addEventListener("chillers:manage-analytics-consent", reopenPrompt);
    return () => window.removeEventListener("chillers:manage-analytics-consent", reopenPrompt);
  }, []);

  const saveChoice = useCallback((nextChoice: Exclude<Choice, null>) => {
    window.localStorage.setItem(CONSENT_KEY, nextChoice);
    setShowPrompt(false);

    if (nextChoice === "accepted") {
      loadAnalytics();
    } else if (window.__chillersAnalyticsLoaded) {
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      document.querySelectorAll('script[data-chillers-analytics="true"]').forEach((script) => script.remove());
      window.__chillersAnalyticsLoaded = false;
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <aside
      aria-label="Choix des statistiques de visite"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#191919] p-4 text-white shadow-2xl sm:inset-x-6 sm:bottom-6 sm:p-5"
    >
      <p className="text-sm font-bold">Aidez-nous à améliorer CHILLERS</p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
        Autorisez-vous les statistiques de visite anonymisées avec Google Analytics ?
        Elles nous aident à comprendre la fréquentation du site. Vous pouvez refuser.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => saveChoice("refused")}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={() => saveChoice("accepted")}
          className="rounded-full bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90"
        >
          Accepter
        </button>
      </div>
    </aside>
  );
}
