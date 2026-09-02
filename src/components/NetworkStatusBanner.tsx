"use client";

import React, { useState, useEffect } from "react";
import { IconWifiOff, IconWifi, IconAntennaBars3, IconX } from "@tabler/icons-react";

export default function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateNetworkStatus = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);

      if (!offline) {
        const nav = navigator as any;
        const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
        if (conn) {
          const slow =
            conn.saveData ||
            conn.effectiveType === "slow-2g" ||
            conn.effectiveType === "2g" ||
            conn.effectiveType === "3g";
          setIsLowBandwidth(Boolean(slow));
        }
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      setDismissed(false);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
      setDismissed(false);
    };

    updateNetworkStatus();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      conn.addEventListener("change", updateNetworkStatus);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (conn) {
        conn.removeEventListener("change", updateNetworkStatus);
      }
    };
  }, []);

  if (dismissed || (!isOffline && !showRestored && !isLowBandwidth)) {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
    >
      {isOffline ? (
        <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-full bg-red-950/90 border border-red-500/40 text-red-200 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <IconWifiOff className="h-4 w-4 text-red-400 animate-pulse shrink-0" />
          <span>Hors ligne · Navigation en cache</span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full text-red-300 hover:text-white hover:bg-red-900/60 transition-colors ml-1 cursor-pointer"
            aria-label="Fermer"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : showRestored ? (
        <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <IconWifi className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Connexion rétablie</span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-colors ml-1 cursor-pointer"
            aria-label="Fermer"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : isLowBandwidth ? (
        <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-semibold shadow-2xl backdrop-blur-md">
          <IconAntennaBars3 className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Réseau faible · Streaming optimisé</span>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-full text-amber-300 hover:text-white hover:bg-amber-900/60 transition-colors ml-1 cursor-pointer"
            aria-label="Fermer"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
