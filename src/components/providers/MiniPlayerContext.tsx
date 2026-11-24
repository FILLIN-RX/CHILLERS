"use client";

import { createContext, useContext } from "react";
import type { MovieOrShow, Episode } from "@/types/media";

export interface MiniPlayerSession {
  key: string;
  item: MovieOrShow;
  episode?: Episode;
  audioVersion: "fr" | "vostfr" | "en";
  streamReferer?: string | null;
}

interface MiniPlayerContextValue {
  setSession: (session: MiniPlayerSession) => void;
  close: () => void;
}

export const MiniPlayerContext = createContext<MiniPlayerContextValue | null>(null);

export function useMiniPlayer() {
  const value = useContext(MiniPlayerContext);
  if (!value) throw new Error("useMiniPlayer must be used inside AppShell");
  return value;
}
