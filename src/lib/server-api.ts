import { getAntiBotHeaders } from "@/lib/antibot";
import { API_BASE_URL, LEGACY_API_BASE_URL } from "@/lib/api-base";

export const API_BASE = API_BASE_URL;

const FALLBACK_API_URL = LEGACY_API_BASE_URL;

export function getServerApiHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: "application/json",
    ...getAntiBotHeaders(),
    ...extraHeaders,
  };
}

export async function serverApiFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${API_BASE}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;

  const options = {
    ...init,
    headers: {
      ...getServerApiHeaders(),
      ...((init?.headers as Record<string, string>) || {}),
    },
  };

  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Primary failed with status ${res.status}`);
    return res;
  } catch (error) {
    if (API_BASE === FALLBACK_API_URL) throw error; // Already using fallback

    const fallbackUrl = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${FALLBACK_API_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
    
    console.warn(`[API] Primary failed for ${url}, trying fallback ${fallbackUrl}`);
    
    return fetch(fallbackUrl, options);
  }
}
