"use client";

import { useEffect } from "react";
import { useNetworkState } from "@uidotdev/usehooks";
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
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isLowBandwidth: false,
  networkType: null,
  setOnline: (isOnline) => set((s) => (s.isOnline === isOnline ? s : { isOnline })),
  setLowBandwidth: (isLowBandwidth) => set((s) => (s.isLowBandwidth === isLowBandwidth ? s : { isLowBandwidth })),
  setNetworkType: (networkType) => set({ networkType }),
}));

/**
 * Hook global basé sur @uidotdev/usehooks → useNetworkState.
 * Stable, SSR-safe, sans ping manuel ni setInterval.
 * Synchronise l'état dans le store Zustand pour les composants qui en ont besoin.
 */
export function useOnlineStatus() {
  const network = useNetworkState();
  const setOnline = useNetworkStore((s) => s.setOnline);
  const setLowBandwidth = useNetworkStore((s) => s.setLowBandwidth);
  const setNetworkType = useNetworkStore((s) => s.setNetworkType);

  const isOnline = network.online ?? true;
  const effectiveType = (network as any).effectiveType as string | undefined;
  const saveData = (network as any).saveData as boolean | undefined;
  const isLowBandwidth =
    Boolean(saveData) ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    effectiveType === "3g";

  useEffect(() => {
    setOnline(isOnline);
    setLowBandwidth(isLowBandwidth);
    setNetworkType(effectiveType ?? null);
  }, [isOnline, isLowBandwidth, effectiveType, setOnline, setLowBandwidth, setNetworkType]);

  return { isOnline, isLowBandwidth, networkType: effectiveType ?? null };
}
