import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import {
  getAnimeSeries,
  getPopularMovies,
  getPopularTV,
  getTopRatedMovies,
} from "@/services/media";
import type { MovieOrShow } from "@/types/media";

// Le sitemap doit suivre les nouveautés sans attendre un redéploiement.
export const revalidate = 21600;

type StaticPage = { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number };

// Uniquement des routes qui existent réellement (src/app/**/page.tsx).
// Sont exclus volontairement : /login /register /profile /offline /test-error /test-lang /matches/test /admin
const STATIC_PAGES: StaticPage[] = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/media/movies", changeFrequency: "daily", priority: 0.9 },
  { path: "/media/series", changeFrequency: "daily", priority: 0.9 },
  { path: "/media/anime", changeFrequency: "daily", priority: 0.8 },
  { path: "/live", changeFrequency: "hourly", priority: 0.8 },
  { path: "/matches", changeFrequency: "daily", priority: 0.7 },
  { path: "/categories", changeFrequency: "weekly", priority: 0.6 },
  { path: "/subscribe", changeFrequency: "monthly", priority: 0.5 },
  { path: "/downloads", changeFrequency: "monthly", priority: 0.4 },
  { path: "/about", changeFrequency: "monthly", priority: 0.3 },
  { path: "/support", changeFrequency: "monthly", priority: 0.3 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
];

type Route = "media" | "tv";

// /tv/{id} est la fiche série/anime canonique, /media/{id} la fiche film : ce sont exactement
// les URL que l'app utilise elle-même pour lier (MovieCard). Y ajouter ?type=tv renverrait
// Google sur une coquille vide qui se redirige côté client, donc non indexée.
function mediaUrl(item: MovieOrShow, route: Route): string {
  return `${SITE_URL}/${route}/${item.id}`;
}

function mediaEntry(
  item: MovieOrShow,
  route: Route,
  priority: number
): MetadataRoute.Sitemap[number] | null {
  if (!item?.id) return null;
  const now = new Date();
  const released = item.releaseDate ? new Date(item.releaseDate) : null;
  // Google ignore un <lastmod> postérieur à aujourd'hui ; les sorties "à venir" sont donc bornées.
  const lastmod = released && !Number.isNaN(released.getTime()) && released < now ? released : now;
  return {
    url: mediaUrl(item, route),
    lastModified: lastmod,
    changeFrequency: "weekly",
    priority,
  };
}

// Une page qui échoue ne doit pas vider le sitemap : on la remplace par une liste vide.
async function safe<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return [] as unknown as T;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out = new Map<string, MetadataRoute.Sitemap[number]>();

  const now = new Date();
  for (const page of STATIC_PAGES) {
    out.set(`${SITE_URL}${page.path}`, {
      url: `${SITE_URL}${page.path}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  // La route dépend de la liste d'origine : item.type peut être "documentary" ou "anime"
  // pour une série TV, et ces étiquettes ne disent pas sur quelle route la fiche se rend.
  const lists = await Promise.all([
    ...[1, 2, 3].map((p) =>
      safe(() => getPopularMovies(p)).then((items) => [items, "media", 0.7] as const)
    ),
    ...[1, 2, 3].map((p) =>
      safe(() => getPopularTV(p)).then((items) => [items, "tv", 0.7] as const)
    ),
    ...[1, 2, 3].map((p) =>
      safe(() => getAnimeSeries(p)).then((items) => [items, "tv", 0.65] as const)
    ),
    ...[1, 2].map((p) =>
      safe(() => getTopRatedMovies(p)).then((items) => [items, "media", 0.6] as const)
    ),
  ]);

  for (const [items, route, priority] of lists) {
    for (const item of items) {
      const entry = mediaEntry(item, route, priority);
      // Une fiche déjà listée avec une priorité plus forte garde la sienne.
      if (entry && !out.has(entry.url)) out.set(entry.url, entry);
    }
  }

  return [...out.values()];
}
