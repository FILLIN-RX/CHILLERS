import { API_BASE_URL } from "@/lib/api-base";
import type { OhaChannel } from "@/types/oha";

/** The backend reads the OHA channel index from Mongo; the web tier never scrapes it. */
export async function getOhaChannels(): Promise<OhaChannel[]> {
  const response = await fetch(`${API_BASE_URL}/live/oha/channels`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`OHA Mongo catalog HTTP ${response.status}`);

  const payload = await response.json() as { success?: boolean; data?: OhaChannel[]; message?: string };
  if (!payload.success || !Array.isArray(payload.data)) {
    throw new Error(payload.message || "OHA Mongo catalog unavailable");
  }
  return payload.data;
}
