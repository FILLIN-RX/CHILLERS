import { getAntiBotHeaders } from "@/lib/antibot";

const isProd = process.env.NODE_ENV === "production";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (isProd ? "https://chillers.onrender.com/api" : "http://localhost:4000/api");

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

  return fetch(url, {
    ...init,
    headers: {
      ...getServerApiHeaders(),
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
}
