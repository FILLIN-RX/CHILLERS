"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";

interface NetworkState {
  isOnline: boolean;
  isLowBandwidth: boolean;
  setOnline: (online: boolean) => void;
  setLowBandwidth: (low: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isLowBandwidth: false,
  setOnline: (isOnline) => set({ isOnline }),
  setLowBandwidth: (isLowBandwidth) => set({ isLowBandwidth }),
}));

/**
 * Hook global pour écouter l'état du réseau (en ligne / hors ligne / bande passante faible)
 */
export function useOnlineStatus() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isLowBandwidth = useNetworkStore((s) => s.isLowBandwidth);
  const setOnline = useNetworkStore((s) => s.setOnline);
  const setLowBandwidth = useNetworkStore((s) => s.setLowBandwidth);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkNetwork = () => {
      const online = navigator.onLine;
      setOnline(online);

      if (online) {
        const nav = navigator as any;
        const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
        if (conn) {
          const slow =
            conn.saveData ||
            conn.effectiveType === "slow-2g" ||
            conn.effectiveType === "2g" ||
            conn.effectiveType === "3g";
          setLowBandwidth(Boolean(slow));
        }
      }
    };

    const handleOnline = () => {
      setOnline(true);
      checkNetwork();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    checkNetwork();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      conn.addEventListener("change", checkNetwork);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (conn) {
        conn.removeEventListener("change", checkNetwork);
      }
    };
  }, [setOnline, setLowBandwidth]);

  return { isOnline, isLowBandwidth };
}
