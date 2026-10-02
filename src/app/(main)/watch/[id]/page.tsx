import { Metadata } from "next";
import { Suspense, cache } from "react";
import { buildMediaMetadata, buildMediaJsonLd } from "@/lib/seo";
import { getMediaDetails, getSeasonDetails } from "@/services/media";
import WatchSkeleton from "@/components/WatchSkeleton";
import WatchContent from "./watch-content";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getCachedMediaDetails = cache(async (id: string, isTV: boolean) => {
  return getMediaDetails(id, isTV).catch(() => null);
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series" || sp?.type === "anime";

  try {
    const d = await getCachedMediaDetails(id, isTV);
    if (d) {
      return buildMediaMetadata({
        id,
        title: d.title,
        type: isTV ? "tv" : "movie",
        overview: d.synopsis || d.description,
        posterPath: d.posterUrl,
        backdropPath: d.backdropUrl,
        year: d.year,
        rating: d.rating,
        genres: d.genres,
        path: `/watch/${id}?type=${isTV ? "tv" : "movie"}`,
        context: "watch",
      });
    }
  } catch {}

  return {};
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const isTV = sp?.type === "tv" || sp?.type === "series" || sp?.type === "anime";
  const seasonParam = parseInt((sp?.season as string) || "1", 10);

  // Exécution ultra-rapide côté serveur (<100ms) : métadonnées et détails de saison uniquement
  const [item, seasonData] = await Promise.all([
    getCachedMediaDetails(id, isTV),
    isTV ? getSeasonDetails(id, String(seasonParam)).catch(() => null) : Promise.resolve(null),
  ]);

  const jsonLd = item
    ? buildMediaJsonLd({
        id,
        title: item.title,
        type: isTV ? "tv" : "movie",
        overview: item.synopsis || item.description,
        posterPath: item.posterUrl,
        backdropPath: item.backdropUrl,
        year: item.year,
        rating: item.rating,
        genres: item.genres,
        path: `/watch/${id}?type=${isTV ? "tv" : "movie"}`,
        context: "watch",
      })
    : null;

  return (
    <Suspense fallback={<WatchSkeleton />}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <WatchContent
        initialItem={item}
        initialSeasonData={seasonData}
      />
    </Suspense>
  );
}
