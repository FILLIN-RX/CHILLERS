"use client";

import { createContext, useContext } from "react";
import type { MovieOrShow } from "@/types/media";

interface HomeActionContextType {
  onWatchNow: (item: MovieOrShow, season?: number, episode?: number, lang?: "fr" | "vostfr") => void;
  onOpenDetails: (item: MovieOrShow) => void;
  onResume: (item: MovieOrShow, season?: number, episode?: number) => void;
}

const HomeActionContext = createContext<HomeActionContextType | null>(null);

export const HomeActionProvider = HomeActionContext.Provider;

export function useHomeActions() {
  const context = useContext(HomeActionContext);
  if (!context) {
    throw new Error("useHomeActions must be used within a HomeActionProvider");
  }
  return context;
}
