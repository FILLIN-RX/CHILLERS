import { httpJson } from "./http";
import type { EpgGuide } from "@/types/epg";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Grille TV complète (EPGShare01) ou now/next OHA sur une fenêtre de dates. */
export async function getEpgGuide(params: {
  from: string;
  to: string;
  channels?: string[];
}): Promise<EpgGuide> {
  const res = await httpJson<Envelope<EpgGuide>>("/live/epg", {
    query: {
      from: params.from,
      to: params.to,
      channels: params.channels?.length ? params.channels.join(",") : undefined,
    },
    timeoutMs: 20_000,
  });
  if (!res?.success || !res.data) {
    throw new Error(res?.message || "epg unavailable");
  }
  return res.data;
}
