"use client";

import { useState, useEffect } from "react";
import { create } from "zustand";

interface NetworkState {
  isOnline: boolean;
  isLowBandwidth: boolean;
  networkType: string | null;
  setOnline: (online: boolean) => void;
  setLowBandwidth: (low: boolean) => void;
  setNetworkType: (type: string | null) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  isLowBandwidth: false,
  networkType: null,
  setOnline: (isOnline) => set((s) => (s.isOnline === isOnline ? s : { isOnline })),
  setLowBandwidth: (isLowBandwidth) => set((s) => (s.isLowBandwidth === isLowBandwidth ? s : { isLowBandwidth })),
  setNetworkType: (networkType) => set({ networkType }),
}));

/**
 * Hook global SSR-safe sans dépendance buggée.
 * Écoute les événements natifs online / offline et l'API NetworkInformation.
 */
export function useOnlineStatus() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnlineState] = useState(true);
  const [lowBandwidth, setLowBandwidthState] = useState(false);
  const [netType, setNetType] = useState<string | null>(null);

  const setStoreOnline = useNetworkStore((s) => s.setOnline);
  const setStoreLowBandwidth = useNetworkStore((s) => s.setLowBandwidth);
  const setStoreNetworkType = useNetworkStore((s) => s.setNetworkType);

  useEffect(() => {
    setMounted(true);

    const update = () => {
      const isCurrentlyOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      setOnlineState(isCurrentlyOnline);
      setStoreOnline(isCurrentlyOnline);

      if (typeof navigator !== "undefined") {
        const nav = navigator as any;
        const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
        if (conn) {
          const effType = conn.effectiveType as string | undefined;
          const isLow = Boolean(conn.saveData) || effType === "slow-2g" || effType === "2g" || effType === "3g";
          setLowBandwidthState(isLow);
          setNetType(effType || null);
          setStoreLowBandwidth(isLow);
          setStoreNetworkType(effType || null);
        }
      }
    };

    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
    if (conn) {
      conn.addEventListener("change", update);
    }

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (conn) {
        conn.removeEventListener("change", update);
      }
    };
  }, [setStoreOnline, setStoreLowBandwidth, setStoreNetworkType]);

  return {
    isOnline: mounted ? online : true,
    isLowBandwidth: mounted ? lowBandwidth : false,
    networkType: mounted ? netType : null,
  };
}
