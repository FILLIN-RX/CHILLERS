import { MetadataRoute } from "next";
import { API_BASE } from "@/lib/server-api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://chillers.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/movies`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/series`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/anime`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/categories`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
    { url: `${SITE_URL}/support`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const dynamicRoutes: MetadataRoute.Sitemap = [];

  const fetchPage = async (url: string): Promise<any[]> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const json = await res.json();
      if (json.success && json.data?.results) return json.data.results;
    } catch {}
    return [];
  };

  const [movies, series, anime] = await Promise.all([
    fetchPage(`${API_BASE}/movies/popular?page=1&language=fr`),
    fetchPage(`${API_BASE}/tv/popular?page=1&language=fr`),
    fetchPage(`${API_BASE}/tv/anime?page=1&language=fr`),
  ]);

  for (const m of movies) {
    dynamicRoutes.push({
      url: `${SITE_URL}/media/${m.id}?type=movie`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const s of series) {
    dynamicRoutes.push({
      url: `${SITE_URL}/media/${s.id}?type=tv`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const a of anime) {
    dynamicRoutes.push({
      url: `${SITE_URL}/media/${a.id}?type=tv`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return [...staticRoutes, ...dynamicRoutes];
}
