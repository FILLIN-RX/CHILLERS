// Public API of the Live TV module. All calls go through services/http.ts.
import { httpJson } from "./http";
import type { LiveChannel } from "@/types/live";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function getLiveChannels(params?: {
  category?: string;
  country?: string;
}): Promise<LiveChannel[]> {
  const res = await httpJson<Envelope<LiveChannel[]>>("/live/channels", {
    query: params,
  });
  return res.data ?? [];
}

export async function getLiveChannel(slug: string): Promise<LiveChannel | null> {
  const res = await httpJson<Envelope<LiveChannel>>(`/live/channels/${slug}`);
  return res.data ?? null;
}

export async function getLiveCategories(): Promise<string[]> {
  const res = await httpJson<Envelope<string[]>>("/live/channels/categories");
  return res.data ?? [];
}
